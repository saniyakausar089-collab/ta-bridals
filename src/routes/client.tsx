import { useState, useEffect, useCallback } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Music2,
  Clock3,
  CheckCircle2,
  XCircle,
  LogOut,
  RefreshCw,
  Sparkles,
  ArrowRight,
  Heart,
  ShieldCheck,
  AlertCircle,
  Calendar,
  User,
  Mail,
  Lock,
  Phone,
  Layers,
  Youtube,
  Play,
  X,
  ExternalLink,
  Plus,
  FileText,
  Settings,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AccountSettingsModal } from "@/components/AccountSettingsModal";
import { songLibraryConfig } from "@/config/songLibraryConfig";
import {
  clientLogin,
  clientSignUp,
  clientSignOut,
  getClientSession,
  restoreClientSession,
  refreshClientStatus,
  getSongsByLibrary,
  getSongPlaybackUrl,
  saveClientSelections,
  getClientSelections,
  addClientCustomSongRequest,
  getClientCustomSongRequests,
  DEMO_CLIENT_ACCOUNTS,
} from "@/lib/songLibraryService";
import {
  WEDDING_EVENT_GROUPS,
  type ClientProfile,
  type ClientApprovalStatus,
  type SongItem,
  type WeddingEventGroup,
  type ClientCustomSongRequest,
} from "@/types/songLibrary";

export const Route = createFileRoute("/client")({
  component: ClientRouteComponent,
});

function ClientRouteComponent() {
  const [session, setSession] = useState<ClientProfile | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [checkingStatus, setCheckingStatus] = useState<boolean>(false);
  const [authError, setAuthError] = useState<string>("");
  const [successNotice, setSuccessNotice] = useState<string>("");

  // Songs & selections state for approved clients
  const [songs, setSongs] = useState<SongItem[]>([]);
  const [loadingSongs, setLoadingSongs] = useState<boolean>(false);
  const [selectedSongIds, setSelectedSongIds] = useState<Set<string>>(new Set());
  const [savingSelections, setSavingSelections] = useState<boolean>(false);
  const [selectionNotice, setSelectionNotice] = useState<string>("");
  const [playingSongId, setPlayingSongId] = useState<string | null>(null);
  const [audioElement, setAudioElement] = useState<HTMLAudioElement | null>(null);

  // Custom client song requests & notes
  const [customSongRequests, setCustomSongRequests] = useState<ClientCustomSongRequest[]>([]);
  const [clientSelectionNotes, setClientSelectionNotes] = useState<string>("");
  const [isAddingCustomSong, setIsAddingCustomSong] = useState<boolean>(false);
  const [customSongTitle, setCustomSongTitle] = useState<string>("");
  const [customSongArtist, setCustomSongArtist] = useState<string>("");
  const [customSongEventGroup, setCustomSongEventGroup] =
    useState<WeddingEventGroup>("Bride Entry");
  const [customSongYoutubeUrl, setCustomSongYoutubeUrl] = useState<string>("");
  const [customSongNotes, setCustomSongNotes] = useState<string>("");
  const [savingCustomSong, setSavingCustomSong] = useState<boolean>(false);
  const [customSongNotice, setCustomSongNotice] = useState<string>("");

  // Login form state
  const [loginEmail, setLoginEmail] = useState<string>("");
  const [loginPassword, setLoginPassword] = useState<string>("");

  // Signup form state (role is NEVER an option)
  const [fullName, setFullName] = useState<string>("");
  const [partnerName, setPartnerName] = useState<string>("");
  const [signupEmail, setSignupEmail] = useState<string>("");
  const [signupPhone, setSignupPhone] = useState<string>("");
  const [weddingDate, setWeddingDate] = useState<string>("");
  const [signupPassword, setSignupPassword] = useState<string>("");
  const [confirmPassword, setConfirmPassword] = useState<string>("");

  // Restore session on mount
  useEffect(() => {
    void (async () => {
      const current = await restoreClientSession();
      setSession(current);
      setLoading(false);
    })();
  }, []);

  // Quick fill helper for testing demo accounts
  const handleQuickDemo = (demoAccount: (typeof DEMO_CLIENT_ACCOUNTS)[number]) => {
    setAuthError("");
    setSuccessNotice("");
    setLoginEmail(demoAccount.profile.email);
    setLoginPassword(demoAccount.demoPasswordHint);
    setMode("login");
  };

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError("");
    setSuccessNotice("");
    setLoading(true);

    try {
      const res = await clientLogin(loginEmail, loginPassword);
      if (!res.success || !res.client) {
        setAuthError(res.error || "Login failed.");
      } else {
        setSession(res.client);
      }
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : "Failed to sign in.");
    } finally {
      setLoading(false);
    }
  };

  const handleSignUpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError("");
    setSuccessNotice("");
    setLoading(true);

    try {
      const res = await clientSignUp({
        fullName,
        partnerName,
        email: signupEmail,
        phone: signupPhone,
        weddingDate,
        password: signupPassword,
        confirmPassword,
      });

      if (!res.success || !res.client) {
        setAuthError(res.error || "Signup failed.");
      } else {
        setSession(res.client);
        setSuccessNotice("Registration received! Your account is awaiting studio approval.");
      }
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : "Failed to create account.");
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = async () => {
    if (audioElement) audioElement.pause();
    await clientSignOut();
    setSession(null);
    setLoginPassword("");
    setAuthError("");
    setSuccessNotice("");
    setSongs([]);
    setSelectedSongIds(new Set());
  };

  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  const handleRefreshStatus = async () => {
    if (!session) return;
    setCheckingStatus(true);
    try {
      const newStatus = await refreshClientStatus(session.id);
      setSession((prev) => (prev ? { ...prev, approvalStatus: newStatus } : null));
    } finally {
      setCheckingStatus(false);
    }
  };

  // Stop audio on unmount
  useEffect(() => {
    return () => {
      if (audioElement) {
        audioElement.pause();
      }
    };
  }, [audioElement]);

  // Load songs, custom song requests & existing selections when client is approved & assigned
  useEffect(() => {
    if (session?.approvalStatus === "approved" && session.assignedLibraryId) {
      void (async () => {
        setLoadingSongs(true);
        try {
          const [loadedSongs, savedSelections, customSongs] = await Promise.all([
            getSongsByLibrary(session.assignedLibraryId!),
            getClientSelections(session.id),
            getClientCustomSongRequests(session.id),
          ]);
          setSongs(loadedSongs);
          setSelectedSongIds(new Set(savedSelections.map((s) => s.songId)));
          setCustomSongRequests(customSongs);

          // Restore saved notes if cached
          if (typeof window !== "undefined") {
            try {
              const raw = localStorage.getItem("ta_bridals_mock_client_selections");
              if (raw) {
                const map = JSON.parse(raw);
                if (map[session.id] && map[session.id].notes) {
                  setClientSelectionNotes(map[session.id].notes);
                }
              }
            } catch {
              // ignore
            }
          }
        } catch (err) {
          console.error("Failed to load client library songs:", err);
        } finally {
          setLoadingSongs(false);
        }
      })();
    }
  }, [session?.approvalStatus, session?.assignedLibraryId, session?.id]);

  // YouTube preview player state
  const [activeYouTubeVideoId, setActiveYouTubeVideoId] = useState<string | null>(null);

  const handleToggleSongSelect = (songId: string) => {
    const next = new Set(selectedSongIds);
    if (next.has(songId)) {
      next.delete(songId);
    } else {
      next.add(songId);
    }
    setSelectedSongIds(next);
  };

  const handleAddCustomSongRequest = async () => {
    if (!customSongTitle.trim()) {
      setCustomSongNotice("Please enter a song name or title.");
      return;
    }

    if (!session?.id) return;

    setSavingCustomSong(true);
    setCustomSongNotice("");
    try {
      const res = await addClientCustomSongRequest(session.id, {
        songTitle: customSongTitle.trim(),
        artistOrDetails: customSongArtist.trim() || undefined,
        eventGroup: customSongEventGroup,
        youtubeUrl: customSongYoutubeUrl.trim() || undefined,
        notes: customSongNotes.trim() || undefined,
      });

      if (!res.success || !res.customRequest) {
        setCustomSongNotice(res.error || "Failed to add custom song request.");
      } else {
        setCustomSongRequests((prev) => [res.customRequest!, ...prev]);
        setCustomSongNotice(`Added "${customSongTitle}" to your wedding requests!`);
        setCustomSongTitle("");
        setCustomSongArtist("");
        setCustomSongYoutubeUrl("");
        setCustomSongNotes("");
        setIsAddingCustomSong(false);
      }
    } catch (err) {
      setCustomSongNotice(err instanceof Error ? err.message : "Error saving request.");
    } finally {
      setSavingCustomSong(false);
    }
  };

  const handleSaveAllSelections = async () => {
    if (
      selectedSongIds.size === 0 &&
      customSongRequests.length === 0 &&
      !clientSelectionNotes.trim()
    ) {
      setSelectionNotice(
        "Please select at least one song or add a custom song request before saving.",
      );
      return;
    }

    setSavingSelections(true);
    setSelectionNotice("");
    try {
      const selectionsPayload = songs
        .filter((s) => selectedSongIds.has(s.id))
        .map((s) => ({ songId: s.id, eventGroup: s.eventGroup }));

      const res = await saveClientSelections(
        selectionsPayload,
        session?.id,
        clientSelectionNotes.trim() || undefined,
      );
      if (!res.success) {
        setSelectionNotice(res.error || "Failed to save selections.");
      } else {
        const total = selectedSongIds.size + customSongRequests.length;
        setSelectionNotice(
          `Successfully saved your wedding music choices (${total} total song${total === 1 ? "" : "s"} selected & requested)!`,
        );
      }
    } catch (err) {
      setSelectionNotice(err instanceof Error ? err.message : "Error saving selections.");
    } finally {
      setSavingSelections(false);
    }
  };

  const handleTogglePlay = async (song: SongItem) => {
    if (playingSongId === song.id) {
      if (audioElement) audioElement.pause();
      setPlayingSongId(null);
    } else {
      if (audioElement) audioElement.pause();
      try {
        const url = await getSongPlaybackUrl(song.audioFileName || song.id);
        if (!url) {
          alert("Audio preview is not available for this song.");
          return;
        }
        const audio = new Audio(url);
        audio.onended = () => setPlayingSongId(null);
        audio.play().catch(() => setPlayingSongId(null));
        setAudioElement(audio);
        setPlayingSongId(song.id);
      } catch {
        alert("Could not load audio preview.");
      }
    }
  };

  // Demo Banner component shown on all client screens
  const DemoDataBanner = () => {
    if (!songLibraryConfig.isMockMode) return null;
    return (
      <div className="w-full border-b border-amber-200 bg-amber-50 px-4 py-2 text-xs text-amber-900">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 font-medium">
            <span className="flex size-2 rounded-full bg-amber-600 animate-pulse" />
            <span>Demo Data Mode Active</span>
            <span className="text-amber-700 font-normal">
              — Isolated service layer. Real passwords are never stored in browser.
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-1.5 text-xs">
            <span className="text-amber-800 font-medium">Quick switch:</span>
            {DEMO_CLIENT_ACCOUNTS.map((acc) => (
              <button
                key={acc.profile.id}
                type="button"
                onClick={() => handleQuickDemo(acc)}
                className="rounded border border-amber-300 bg-white px-2 py-0.5 text-[11px] font-medium text-amber-900 shadow-2xs hover:bg-amber-100 transition-colors"
              >
                {acc.profile.approvalStatus === "approved"
                  ? "Approved Client"
                  : acc.profile.approvalStatus === "pending"
                    ? "Pending Client"
                    : "Rejected Client"}
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#fbfaf7] text-stone-600">
        <div className="flex items-center gap-2 text-sm">
          <RefreshCw className="size-4 animate-spin text-stone-400" />
          <span>Verifying client access...</span>
        </div>
      </div>
    );
  }

  // SCREEN 1: Client is logged in and status is PENDING
  if (session && session.approvalStatus === "pending") {
    return (
      <div className="min-h-screen bg-[#fbfaf7] text-stone-800 flex flex-col">
        <DemoDataBanner />
        <main className="flex-1 flex items-center justify-center px-4 py-12">
          <div className="w-full max-w-lg rounded-2xl border border-stone-200/80 bg-white p-8 shadow-sm">
            <div className="flex items-center justify-between border-b border-stone-100 pb-5">
              <div className="flex items-center gap-2">
                <div className="flex size-9 items-center justify-center rounded-xl bg-amber-100 text-amber-800">
                  <Music2 className="size-5" />
                </div>
                <div>
                  <h2 className="text-sm font-semibold tracking-wide text-stone-900 uppercase">
                    TA Bridals
                  </h2>
                  <p className="text-[11px] text-stone-500">Client Song Library</p>
                </div>
              </div>
              <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-0.5 text-xs font-medium text-amber-800">
                <Clock3 className="size-3" />
                Pending Approval
              </span>
            </div>

            <div className="mt-6 text-center sm:text-left">
              <h1 className="font-serif text-2xl font-normal text-stone-900">
                Welcome, {session.fullName}
              </h1>
              <p className="mt-2 text-sm text-stone-600 leading-relaxed">
                Your wedding music registration has been submitted. The studio owner reviews all
                client accounts before granting access to your assigned wedding song library.
              </p>
            </div>

            <div className="mt-6 rounded-xl border border-stone-100 bg-stone-50/70 p-4 space-y-2 text-xs text-stone-600">
              <div className="flex justify-between py-1 border-b border-stone-200/50">
                <span className="text-stone-500">Client Account:</span>
                <span className="font-medium text-stone-800">{session.fullName}</span>
              </div>
              {session.partnerName && (
                <div className="flex justify-between py-1 border-b border-stone-200/50">
                  <span className="text-stone-500">Partner:</span>
                  <span className="font-medium text-stone-800">{session.partnerName}</span>
                </div>
              )}
              <div className="flex justify-between py-1 border-b border-stone-200/50">
                <span className="text-stone-500">Email:</span>
                <span className="font-medium text-stone-800">{session.email}</span>
              </div>
              {session.weddingDate && (
                <div className="flex justify-between py-1 border-b border-stone-200/50">
                  <span className="text-stone-500">Wedding Date:</span>
                  <span className="font-medium text-stone-800">{session.weddingDate}</span>
                </div>
              )}
              <div className="flex justify-between py-1">
                <span className="text-stone-500">Status:</span>
                <span className="font-semibold text-amber-700">Awaiting Admin Review</span>
              </div>
            </div>

            <div className="mt-6 flex flex-col sm:flex-row gap-2.5">
              <Button
                variant="outline"
                onClick={handleRefreshStatus}
                disabled={checkingStatus}
                className="flex-1 border-stone-200 hover:bg-stone-50 text-stone-700"
              >
                <RefreshCw className={`size-3.5 mr-1.5 ${checkingStatus ? "animate-spin" : ""}`} />
                Check Status
              </Button>
              <Button
                variant="ghost"
                onClick={handleSignOut}
                className="text-stone-600 hover:text-stone-900"
              >
                <LogOut className="size-3.5 mr-1.5" />
                Sign Out
              </Button>
            </div>
          </div>
        </main>
      </div>
    );
  }

  // SCREEN 2: Client is logged in and status is REJECTED
  if (session && session.approvalStatus === "rejected") {
    return (
      <div className="min-h-screen bg-[#fbfaf7] text-stone-800 flex flex-col">
        <DemoDataBanner />
        <main className="flex-1 flex items-center justify-center px-4 py-12">
          <div className="w-full max-w-lg rounded-2xl border border-rose-200 bg-white p-8 shadow-sm">
            <div className="flex items-center justify-between border-b border-stone-100 pb-5">
              <div className="flex items-center gap-2">
                <div className="flex size-9 items-center justify-center rounded-xl bg-rose-100 text-rose-800">
                  <Music2 className="size-5" />
                </div>
                <div>
                  <h2 className="text-sm font-semibold tracking-wide text-stone-900 uppercase">
                    TA Bridals
                  </h2>
                  <p className="text-[11px] text-stone-500">Client Song Library</p>
                </div>
              </div>
              <span className="inline-flex items-center gap-1 rounded-full border border-rose-200 bg-rose-50 px-2.5 py-0.5 text-xs font-medium text-rose-800">
                <XCircle className="size-3" />
                Registration Declined
              </span>
            </div>

            <div className="mt-6 text-center sm:text-left">
              <h1 className="font-serif text-2xl font-normal text-stone-900">
                Access Not Available
              </h1>
              <p className="mt-2 text-sm text-stone-600 leading-relaxed">
                Your client registration could not be approved at this time. If you believe this is
                an error or if you have booked a shoot with TA Bridals under a different email,
                please contact your studio manager directly.
              </p>

              {session.rejectionReason && (
                <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50/70 p-3.5 text-xs text-rose-900">
                  <div className="font-semibold text-rose-950 flex items-center gap-1.5 mb-1">
                    <AlertCircle className="size-3.5 text-rose-700" />
                    Reason provided by studio:
                  </div>
                  <p className="text-rose-800 leading-relaxed italic">
                    &ldquo;{session.rejectionReason}&rdquo;
                  </p>
                </div>
              )}
            </div>

            <div className="mt-6 flex justify-end">
              <Button
                variant="outline"
                onClick={handleSignOut}
                className="border-stone-200 text-stone-700"
              >
                <LogOut className="size-3.5 mr-1.5" />
                Sign Out to Client Login
              </Button>
            </div>
          </div>
        </main>
      </div>
    );
  }

  // SCREEN 3: Client is APPROVED (Ready for Step 5 Full Library)
  if (session && session.approvalStatus === "approved") {
    return (
      <div className="min-h-screen bg-[#fbfaf7] text-stone-800 flex flex-col">
        <DemoDataBanner />
        <header className="border-b border-stone-200/80 bg-white px-6 py-4">
          <div className="mx-auto flex max-w-6xl items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-xl bg-[#2d3a2e] text-white">
                <Music2 className="size-5" />
              </div>
              <div>
                <h1 className="text-base font-semibold text-stone-900 tracking-tight">
                  TA Bridals Song Library
                </h1>
                <p className="text-xs text-stone-500">
                  Welcome, {session.fullName}
                  {session.partnerName ? ` & ${session.partnerName}` : ""}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <span className="hidden sm:inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-800">
                <ShieldCheck className="size-3.5" />
                Approved Client
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsSettingsOpen(true)}
                className="border-stone-200 text-xs text-stone-700 hover:bg-stone-100"
              >
                <Settings className="size-3.5 mr-1 text-stone-600" />
                Settings
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleSignOut}
                className="border-stone-200 text-xs text-stone-700"
              >
                <LogOut className="size-3.5 mr-1" />
                Sign Out
              </Button>
            </div>
          </div>
        </header>

        <AccountSettingsModal
          isOpen={isSettingsOpen}
          onClose={() => setIsSettingsOpen(false)}
          currentName={session.fullName}
          userEmail={session.email}
          role="client"
          clientId={session.id}
          onNameUpdated={(newName) => {
            setSession((prev) => (prev ? { ...prev, fullName: newName } : null));
          }}
        />

        <main className="flex-1 mx-auto w-full max-w-6xl px-4 py-8">
          <div className="rounded-2xl border border-stone-200 bg-white p-8 text-center shadow-xs">
            <div className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-800">
              <CheckCircle2 className="size-6" />
            </div>
            <h2 className="mt-4 font-serif text-2xl font-normal text-stone-900">
              Account Approved & Verified
            </h2>
            <p className="mt-2 text-sm text-stone-600 max-w-lg mx-auto">
              Your client profile is active!
              {session.assignedLibraryName ? (
                <span>
                  {" "}
                  You have been assigned to the <strong>{session.assignedLibraryName}</strong>.
                </span>
              ) : (
                <span> Your library assignment will appear shortly once selected by admin.</span>
              )}
            </p>

            <div className="mt-6 rounded-xl border border-stone-100 bg-stone-50 p-4 max-w-md mx-auto text-left text-xs space-y-1.5">
              <div className="flex justify-between">
                <span className="text-stone-500">Client ID:</span>
                <span className="font-mono text-stone-700">{session.id}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-stone-500">Assigned Library:</span>
                <span className="font-semibold text-stone-800">
                  {session.assignedLibraryName || "Pending Admin Library Assignment"}
                </span>
              </div>
              {session.weddingDate && (
                <div className="flex justify-between">
                  <span className="text-stone-500">Wedding Date:</span>
                  <span className="font-semibold text-stone-800">{session.weddingDate}</span>
                </div>
              )}
            </div>

            {session.assignedLibraryId ? (
              <div className="mt-8 border-t border-stone-100 pt-6 text-left">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                  <div>
                    <h3 className="font-serif text-lg font-normal text-stone-900">
                      Curated Wedding Soundtrack
                    </h3>
                    <p className="text-xs text-stone-500">
                      Listen to previews, pick your favorite songs for each event, and save your
                      selections.
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setIsAddingCustomSong((v) => !v)}
                      className="border-purple-300 text-purple-900 bg-purple-50 hover:bg-purple-100 text-xs px-3"
                    >
                      <Plus className="size-3.5 mr-1 text-purple-700" />
                      Add Custom Song
                    </Button>
                    <Button
                      onClick={handleSaveAllSelections}
                      disabled={savingSelections}
                      className="bg-[#2d3a2e] hover:bg-[#1f2820] text-white text-xs px-4"
                    >
                      {savingSelections
                        ? "Saving..."
                        : `Save Selections (${selectedSongIds.size + customSongRequests.length})`}
                    </Button>
                  </div>
                </div>

                {/* Custom Song Request Form Modal / Accordion */}
                {isAddingCustomSong && (
                  <div className="mb-6 rounded-2xl border border-purple-200 bg-gradient-to-br from-purple-50/70 to-white p-5 shadow-xs">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <span className="flex size-2 rounded-full bg-purple-600" />
                        <h4 className="font-semibold text-xs uppercase tracking-wider text-purple-950">
                          Request a Song Not in the Library
                        </h4>
                      </div>
                      <button
                        type="button"
                        onClick={() => setIsAddingCustomSong(false)}
                        className="text-stone-400 hover:text-stone-700 text-xs p-1"
                      >
                        Cancel
                      </button>
                    </div>
                    <p className="text-xs text-stone-600 mb-4">
                      Type the song title, artist/movie, and which event you want it played for. Our
                      editing and audio team will review and include it in your wedding edit!
                    </p>

                    <div className="grid gap-3 sm:grid-cols-2">
                      <div>
                        <label className="block text-[11px] font-semibold text-stone-700 mb-1">
                          Song Title / Name *
                        </label>
                        <Input
                          value={customSongTitle}
                          onChange={(e) => setCustomSongTitle(e.target.value)}
                          placeholder="e.g. Afreen Afreen, Tum Hi Ho..."
                          className="h-8.5 text-xs bg-white border-stone-300"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-stone-700 mb-1">
                          Artist / Film / Version (Optional)
                        </label>
                        <Input
                          value={customSongArtist}
                          onChange={(e) => setCustomSongArtist(e.target.value)}
                          placeholder="e.g. Rahat Fateh Ali Khan / Coke Studio"
                          className="h-8.5 text-xs bg-white border-stone-300"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-stone-700 mb-1">
                          Wedding Event Group *
                        </label>
                        <select
                          value={customSongEventGroup}
                          onChange={(e) =>
                            setCustomSongEventGroup(e.target.value as WeddingEventGroup)
                          }
                          className="w-full h-8.5 rounded-md border border-stone-300 bg-white px-2.5 text-xs text-stone-900 focus:outline-hidden"
                        >
                          {WEDDING_EVENT_GROUPS.map((grp) => (
                            <option key={grp} value={grp}>
                              {grp}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-stone-700 mb-1">
                          YouTube Link or Audio URL (Optional)
                        </label>
                        <Input
                          value={customSongYoutubeUrl}
                          onChange={(e) => setCustomSongYoutubeUrl(e.target.value)}
                          placeholder="https://www.youtube.com/watch?v=..."
                          className="h-8.5 text-xs bg-white border-stone-300"
                        />
                      </div>
                      <div className="sm:col-span-2">
                        <label className="block text-[11px] font-semibold text-stone-700 mb-1">
                          Special Timing or Note (Optional)
                        </label>
                        <Input
                          value={customSongNotes}
                          onChange={(e) => setCustomSongNotes(e.target.value)}
                          placeholder="e.g. Please play starting from 01:20 when bride walks in"
                          className="h-8.5 text-xs bg-white border-stone-300"
                        />
                      </div>
                    </div>

                    {customSongNotice && (
                      <p className="mt-3 text-xs text-purple-900 font-medium">{customSongNotice}</p>
                    )}

                    <div className="mt-4 flex justify-end gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setIsAddingCustomSong(false)}
                        className="text-xs h-8 border-stone-300"
                      >
                        Cancel
                      </Button>
                      <Button
                        size="sm"
                        onClick={handleAddCustomSongRequest}
                        disabled={savingCustomSong || !customSongTitle.trim()}
                        className="bg-purple-900 hover:bg-purple-950 text-white text-xs h-8 px-4"
                      >
                        {savingCustomSong ? "Adding..." : "Add to My Song Requests"}
                      </Button>
                    </div>
                  </div>
                )}

                {/* Custom Songs Already Requested by Client */}
                {customSongRequests.length > 0 && (
                  <div className="mb-6 rounded-2xl border border-purple-200 bg-purple-50/30 p-4">
                    <h4 className="text-xs font-semibold uppercase tracking-wider text-purple-950 mb-3 flex items-center gap-1.5">
                      <Plus className="size-3.5 text-purple-700" />
                      <span>Your Custom Song Requests ({customSongRequests.length})</span>
                    </h4>
                    <div className="divide-y divide-purple-100 rounded-xl border border-purple-200 bg-white overflow-hidden">
                      {customSongRequests.map((req) => (
                        <div
                          key={req.id}
                          className="p-3.5 flex flex-wrap items-center justify-between gap-2"
                        >
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-xs text-purple-950">
                                {req.songTitle}
                              </span>
                              <span className="rounded-full bg-purple-100 px-2 py-0.5 text-[10px] font-semibold text-purple-800 border border-purple-200">
                                {req.eventGroup}
                              </span>
                            </div>
                            {req.artistOrDetails && (
                              <p className="text-[11px] text-stone-600 mt-0.5">
                                Artist / Version: {req.artistOrDetails}
                              </p>
                            )}
                            {req.notes && (
                              <p className="text-[11px] italic text-stone-500 mt-0.5">
                                Note: &quot;{req.notes}&quot;
                              </p>
                            )}
                          </div>
                          {req.youtubeUrl && (
                            <a
                              href={req.youtubeUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-[11px] text-red-600 bg-red-50 hover:bg-red-100 border border-red-200 px-2.5 py-1 rounded-lg transition-colors"
                            >
                              <Youtube className="size-3" />
                              <span>Reference</span>
                              <ExternalLink className="size-2.5" />
                            </a>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Client Overall Notes Input */}
                <div className="mb-6 rounded-2xl border border-stone-200 bg-[#fbfaf7] p-4">
                  <label className="block text-xs font-semibold text-stone-800 mb-1 flex items-center gap-1.5">
                    <FileText className="size-3.5 text-stone-600" />
                    <span>Special Instructions / Music Notes for the Studio (Optional)</span>
                  </label>
                  <Input
                    value={clientSelectionNotes}
                    onChange={(e) => setClientSelectionNotes(e.target.value)}
                    placeholder="e.g. We prefer acoustic and soft instruments for dinner, high energy for Sangeet!"
                    className="h-9 text-xs bg-white border-stone-300"
                  />
                  <p className="text-[10px] text-stone-500 mt-1">
                    These notes and your selected tracks are automatically shared with your assigned
                    video editors and lead photographers.
                  </p>
                </div>

                {selectionNotice && (
                  <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-800 flex items-center gap-2">
                    <CheckCircle2 className="size-4 shrink-0" />
                    <span>{selectionNotice}</span>
                  </div>
                )}

                {/* YouTube Video Player Modal for Client */}
                {activeYouTubeVideoId && (
                  <div className="mb-6 rounded-2xl border border-stone-200 bg-black/95 p-4 text-white shadow-lg">
                    <div className="flex items-center justify-between mb-3 px-1">
                      <div className="flex items-center gap-2">
                        <Youtube className="size-4 text-red-500" />
                        <span className="text-xs font-semibold tracking-wide uppercase text-stone-300">
                          YouTube Video Player
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setActiveYouTubeVideoId(null)}
                        className="rounded-lg p-1 text-stone-400 hover:bg-stone-800 hover:text-white transition-colors"
                        title="Close player"
                      >
                        <X className="size-4" />
                      </button>
                    </div>

                    <div className="relative aspect-video w-full max-w-2xl mx-auto overflow-hidden rounded-xl shadow-md">
                      <iframe
                        src={`https://www.youtube-nocookie.com/embed/${activeYouTubeVideoId}?autoplay=1&enablejsapi=1`}
                        title="Wedding Song Video"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowFullScreen
                        className="h-full w-full border-0"
                      />
                    </div>

                    <div className="mt-3 text-center">
                      <a
                        href={`https://www.youtube.com/watch?v=${activeYouTubeVideoId}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 text-xs text-stone-400 hover:text-red-400 transition-colors"
                      >
                        <span>If video doesn't play, watch on YouTube</span>
                        <ExternalLink className="size-3" />
                      </a>
                    </div>
                  </div>
                )}

                {loadingSongs ? (
                  <div className="py-12 text-center text-xs text-stone-500">
                    Loading your assigned soundtrack library...
                  </div>
                ) : songs.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-stone-200 p-8 text-center text-xs text-stone-500">
                    No songs have been added to your library yet. Your studio manager will curate
                    songs for you shortly!
                  </div>
                ) : (
                  <div className="space-y-6">
                    {WEDDING_EVENT_GROUPS.map((eventGroup) => {
                      const groupSongs = songs.filter((s) => s.eventGroup === eventGroup);
                      if (groupSongs.length === 0) return null;

                      return (
                        <div
                          key={eventGroup}
                          className="rounded-xl border border-stone-200 overflow-hidden bg-white shadow-2xs"
                        >
                          <div className="border-b border-stone-100 bg-[#fbfaf7] px-4 py-2.5 flex items-center justify-between">
                            <span className="font-semibold text-xs text-stone-900">
                              {eventGroup}
                            </span>
                            <span className="text-[11px] text-stone-500">
                              {groupSongs.length} tracks
                            </span>
                          </div>
                          <div className="divide-y divide-stone-100">
                            {groupSongs.map((song) => {
                              const isSelected = selectedSongIds.has(song.id);
                              return (
                                <div
                                  key={song.id}
                                  className={`px-4 py-3 flex items-center justify-between gap-3 transition-colors ${
                                    isSelected ? "bg-emerald-50/40" : "hover:bg-stone-50/60"
                                  }`}
                                >
                                  <div className="flex items-center gap-3 min-w-0">
                                    {song.youtubeVideoId ? (
                                      <button
                                        type="button"
                                        onClick={() => {
                                          if (audioElement) audioElement.pause();
                                          setPlayingSongId(null);
                                          setActiveYouTubeVideoId(song.youtubeVideoId!);
                                        }}
                                        className="relative flex size-10 shrink-0 overflow-hidden rounded-lg border border-stone-200 group"
                                        title="Play YouTube video"
                                      >
                                        {song.thumbnailUrl ? (
                                          <img
                                            src={song.thumbnailUrl}
                                            alt={song.title}
                                            className="h-full w-full object-cover"
                                          />
                                        ) : (
                                          <div className="h-full w-full bg-red-600 flex items-center justify-center text-white">
                                            <Youtube className="size-4" />
                                          </div>
                                        )}
                                        <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-85 group-hover:opacity-100 transition-opacity">
                                          <Play className="size-3.5 text-white ml-0.5" />
                                        </div>
                                      </button>
                                    ) : (
                                      <button
                                        type="button"
                                        onClick={() => handleTogglePlay(song)}
                                        className={`flex size-8 shrink-0 items-center justify-center rounded-full transition-colors ${
                                          playingSongId === song.id
                                            ? "bg-[#2d3a2e] text-white"
                                            : "bg-stone-100 text-stone-700 hover:bg-stone-200"
                                        }`}
                                        title="Play audio preview"
                                      >
                                        <Music2 className="size-3.5" />
                                      </button>
                                    )}

                                    <div className="min-w-0">
                                      <div className="flex items-center gap-1.5 flex-wrap">
                                        <p className="text-xs font-semibold text-stone-900 truncate">
                                          {song.title}
                                        </p>
                                        {song.youtubeVideoId && (
                                          <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-red-700 bg-red-50 border border-red-200 px-1.5 py-0.2 rounded">
                                            <Youtube className="size-2.5" />
                                            YouTube
                                          </span>
                                        )}
                                      </div>
                                      <p className="text-[11px] text-stone-500 truncate">
                                        {song.artist || song.channelName} ·{" "}
                                        <span className="text-stone-400">
                                          {song.durationFormatted}
                                        </span>
                                      </p>
                                    </div>
                                  </div>

                                  <div className="flex items-center gap-2 shrink-0">
                                    {song.youtubeUrl && (
                                      <a
                                        href={song.youtubeUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="hidden sm:inline-flex items-center gap-1 text-[11px] text-stone-400 hover:text-red-600 px-2 py-1 rounded transition-colors"
                                        title="Watch on YouTube"
                                      >
                                        <span>Watch</span>
                                        <ExternalLink className="size-3" />
                                      </a>
                                    )}

                                    <button
                                      type="button"
                                      onClick={() => handleToggleSongSelect(song.id)}
                                      className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium transition-all ${
                                        isSelected
                                          ? "bg-emerald-600 text-white shadow-2xs"
                                          : "border border-stone-200 text-stone-600 hover:border-stone-300 hover:bg-stone-50"
                                      }`}
                                    >
                                      {isSelected ? (
                                        <>
                                          <CheckCircle2 className="size-3.5" />
                                          <span>Selected</span>
                                        </>
                                      ) : (
                                        <span>Select Track</span>
                                      )}
                                    </button>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            ) : (
              <div className="mt-8 border-t border-stone-100 pt-6">
                <p className="text-xs text-stone-400">
                  Your registration is verified. Your assigned song library will appear here once
                  linked by studio admin.
                </p>
              </div>
            )}
          </div>
        </main>
      </div>
    );
  }

  // SCREEN 4: Client Login / Signup screen (when signed out)
  return (
    <div className="min-h-screen bg-[#fbfaf7] text-stone-800 flex flex-col">
      <DemoDataBanner />

      <main className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md rounded-2xl border border-stone-200/90 bg-white p-8 shadow-sm">
          {/* Brand header */}
          <div className="text-center">
            <div className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-[#2d3a2e] text-white shadow-xs">
              <Music2 className="size-6" />
            </div>
            <h1 className="mt-4 font-serif text-2xl font-normal text-stone-900">
              TA Bridals Client Portal
            </h1>
            <p className="mt-1 text-xs text-stone-500">
              {mode === "login"
                ? "Sign in to listen, select, and finalize your wedding songs"
                : "Create your couple account to access your curated song library"}
            </p>
          </div>

          {/* Mode Switcher Tabs */}
          <div className="mt-6 grid grid-cols-2 rounded-xl bg-stone-100 p-1 text-xs font-medium">
            <button
              type="button"
              onClick={() => {
                setMode("login");
                setAuthError("");
                setSuccessNotice("");
              }}
              className={`rounded-lg py-2 transition-all ${
                mode === "login"
                  ? "bg-white text-stone-900 shadow-2xs font-semibold"
                  : "text-stone-600 hover:text-stone-900"
              }`}
            >
              Client Login
            </button>
            <button
              type="button"
              onClick={() => {
                setMode("signup");
                setAuthError("");
                setSuccessNotice("");
              }}
              className={`rounded-lg py-2 transition-all ${
                mode === "signup"
                  ? "bg-white text-stone-900 shadow-2xs font-semibold"
                  : "text-stone-600 hover:text-stone-900"
              }`}
            >
              New Client Signup
            </button>
          </div>

          {/* Feedback Alerts */}
          {authError && (
            <div className="mt-4 flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800">
              <AlertCircle className="size-4 shrink-0 mt-0.5" />
              <span>{authError}</span>
            </div>
          )}

          {successNotice && (
            <div className="mt-4 flex items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-800">
              <CheckCircle2 className="size-4 shrink-0 mt-0.5" />
              <span>{successNotice}</span>
            </div>
          )}

          {/* LOGIN FORM */}
          {mode === "login" ? (
            <form onSubmit={handleLoginSubmit} className="mt-6 space-y-4">
              <div>
                <label className="block text-xs font-medium text-stone-700">Client Email</label>
                <div className="relative mt-1">
                  <Mail className="absolute left-3 top-2.5 size-4 text-stone-400" />
                  <Input
                    type="email"
                    required
                    placeholder="client@tabridals.com"
                    value={loginEmail}
                    onChange={(e) => setLoginEmail(e.target.value)}
                    className="pl-9 text-xs"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-medium text-stone-700">Password</label>
                  <span className="text-[11px] text-stone-400">Min 6 characters</span>
                </div>
                <div className="relative mt-1">
                  <Lock className="absolute left-3 top-2.5 size-4 text-stone-400" />
                  <Input
                    type="password"
                    required
                    placeholder="••••••••"
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    className="pl-9 text-xs"
                  />
                </div>
              </div>

              <Button
                type="submit"
                disabled={loading}
                className="w-full bg-[#2d3a2e] hover:bg-[#202b21] text-white text-xs py-2.5 font-medium rounded-xl"
              >
                Sign In to Song Library
                <ArrowRight className="size-3.5 ml-1.5" />
              </Button>
            </form>
          ) : (
            /* SIGNUP FORM */
            <form onSubmit={handleSignUpSubmit} className="mt-5 space-y-3">
              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-[11px] font-medium text-stone-700">
                    Your Full Name *
                  </label>
                  <Input
                    required
                    placeholder="Aanya Verma"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="text-xs mt-1"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-stone-700">
                    Partner Name
                  </label>
                  <Input
                    placeholder="Sameer Sen"
                    value={partnerName}
                    onChange={(e) => setPartnerName(e.target.value)}
                    className="text-xs mt-1"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-medium text-stone-700">Email *</label>
                <Input
                  type="email"
                  required
                  placeholder="aanya@example.com"
                  value={signupEmail}
                  onChange={(e) => setSignupEmail(e.target.value)}
                  className="text-xs mt-1"
                />
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-[11px] font-medium text-stone-700">
                    Phone (optional)
                  </label>
                  <Input
                    placeholder="+91 98765..."
                    value={signupPhone}
                    onChange={(e) => setSignupPhone(e.target.value)}
                    className="text-xs mt-1"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-stone-700">
                    Wedding Date
                  </label>
                  <Input
                    type="date"
                    value={weddingDate}
                    onChange={(e) => setWeddingDate(e.target.value)}
                    className="text-xs mt-1"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-[11px] font-medium text-stone-700">Password *</label>
                  <Input
                    type="password"
                    required
                    placeholder="Min 6 chars"
                    value={signupPassword}
                    onChange={(e) => setSignupPassword(e.target.value)}
                    className="text-xs mt-1"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-stone-700">Confirm *</label>
                  <Input
                    type="password"
                    required
                    placeholder="Repeat password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="text-xs mt-1"
                  />
                </div>
              </div>

              <div className="rounded-lg bg-stone-50 border border-stone-200/60 p-2.5 text-[11px] text-stone-500">
                <strong>Studio Approval Policy:</strong> Client accounts are reviewed by the TA
                Bridals admin before song library access is granted. Signups always start as
                &quot;pending&quot;.
              </div>

              <Button
                type="submit"
                disabled={loading}
                className="w-full bg-[#2d3a2e] hover:bg-[#202b21] text-white text-xs py-2.5 font-medium rounded-xl"
              >
                Register Client Account
                <ArrowRight className="size-3.5 ml-1.5" />
              </Button>
            </form>
          )}

          {/* Link back to Studio Management login for Team/Owner */}
          <div className="mt-6 border-t border-stone-100 pt-4 text-center">
            <Link
              to="/"
              className="text-xs text-stone-500 hover:text-stone-800 transition-colors inline-flex items-center gap-1"
            >
              <span>Are you a Studio team member or Owner?</span>
              <span className="font-medium underline">Studio Portal</span>
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
