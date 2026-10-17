import { useState, useEffect, useCallback } from "react";
import {
  Music2,
  Users,
  CheckCircle2,
  XCircle,
  Clock3,
  Plus,
  Trash2,
  Library,
  Search,
  RefreshCw,
  AlertCircle,
  FolderPlus,
  Calendar,
  ExternalLink,
  Edit2,
  Archive,
  ArchiveRestore,
  Play,
  Pause,
  ChevronRight,
  ArrowLeft,
  FileAudio,
  Tag,
  Check,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { songLibraryConfig } from "@/config/songLibraryConfig";
import {
  getClients,
  getSongLibraries,
  approveClient,
  rejectClient,
  createSongLibrary,
  updateSongLibrary,
  archiveSongLibrary,
  assignClientToLibrary,
  deleteSongLibrary,
  getSongsByLibrary,
  addSongToLibrary,
  updateSong,
  deleteSong,
  getSongPlaybackUrl,
  uploadSongAudio,
} from "@/lib/songLibraryService";
import {
  WEDDING_EVENT_GROUPS,
  type ClientProfile,
  type SongLibraryRecord,
  type ClientApprovalStatus,
  type SongItem,
  type WeddingEventGroup,
} from "@/types/songLibrary";

export function SongLibraryAdminSection() {
  const [activeTab, setActiveTab] = useState<"clients" | "libraries">("clients");
  const [clients, setClients] = useState<ClientProfile[]>([]);
  const [libraries, setLibraries] = useState<SongLibraryRecord[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [successMessage, setSuccessMessage] = useState<string>("");

  // Search & Filter state
  const [clientSearchQuery, setClientSearchQuery] = useState<string>("");
  const [clientStatusFilter, setClientStatusFilter] = useState<"all" | ClientApprovalStatus>("all");
  const [showArchivedLibraries, setShowArchivedLibraries] = useState<boolean>(false);

  // Rejection modal / state
  const [rejectingClientId, setRejectingClientId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState<string>("");

  // Library Creation / Editing State
  const [isCreatingLibrary, setIsCreatingLibrary] = useState<boolean>(false);
  const [editingLibraryId, setEditingLibraryId] = useState<string | null>(null);
  const [libFormName, setLibFormName] = useState<string>("");
  const [libFormDesc, setLibFormDesc] = useState<string>("");
  const [submittingLibrary, setSubmittingLibrary] = useState<boolean>(false);

  // Selected library for browsing & managing songs
  const [selectedLibraryForSongs, setSelectedLibraryForSongs] = useState<SongLibraryRecord | null>(null);
  const [librarySongs, setLibrarySongs] = useState<SongItem[]>([]);
  const [loadingSongs, setLoadingSongs] = useState<boolean>(false);

  // Song Creation / Editing State
  const [isAddingSong, setIsAddingSong] = useState<boolean>(false);
  const [editingSongId, setEditingSongId] = useState<string | null>(null);
  const [songTitle, setSongTitle] = useState<string>("");
  const [songArtist, setSongArtist] = useState<string>("");
  const [songEventGroup, setSongEventGroup] = useState<WeddingEventGroup>("Haldi");
  const [songAudioRef, setSongAudioRef] = useState<string>("");
  const [songFile, setSongFile] = useState<File | null>(null);
  const [uploadingAudio, setUploadingAudio] = useState<boolean>(false);
  const [submittingSong, setSubmittingSong] = useState<boolean>(false);

  // Audio preview player state
  const [playingSongId, setPlayingSongId] = useState<string | null>(null);
  const [audioElement, setAudioElement] = useState<HTMLAudioElement | null>(null);

  // Map for pending client library selection dropdown
  const [selectedLibraryMap, setSelectedLibraryMap] = useState<Record<string, string>>({});

  const loadData = useCallback(async () => {
    setLoading(true);
    setErrorMessage("");
    try {
      const [fetchedClients, fetchedLibraries] = await Promise.all([
        getClients(),
        getSongLibraries(true), // Include archived for admin
      ]);
      setClients(fetchedClients);
      setLibraries(fetchedLibraries);

      // Initialize default library mapping for pending clients
      const initialMap: Record<string, string> = {};
      const activeLibs = fetchedLibraries.filter((l) => !l.isArchived);
      fetchedClients.forEach((c) => {
        if (c.assignedLibraryId) {
          initialMap[c.id] = c.assignedLibraryId;
        } else if (activeLibs.length > 0) {
          initialMap[c.id] = activeLibs[0].id;
        }
      });
      setSelectedLibraryMap(initialMap);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Failed to load song library data.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  // Load songs when a library is selected
  const loadSongs = useCallback(async (libraryId: string) => {
    setLoadingSongs(true);
    try {
      const songs = await getSongsByLibrary(libraryId);
      setLibrarySongs(songs);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Failed to load songs for library.");
    } finally {
      setLoadingSongs(false);
    }
  }, []);

  useEffect(() => {
    if (selectedLibraryForSongs) {
      void loadSongs(selectedLibraryForSongs.id);
    }
  }, [selectedLibraryForSongs, loadSongs]);

  // Stop audio on unmount
  useEffect(() => {
    return () => {
      if (audioElement) {
        audioElement.pause();
      }
    };
  }, [audioElement]);

  const handleTogglePlay = async (songId: string, audioPath?: string) => {
    if (playingSongId === songId) {
      if (audioElement) audioElement.pause();
      setPlayingSongId(null);
    } else {
      if (audioElement) audioElement.pause();
      try {
        const url = await getSongPlaybackUrl(audioPath || songId);
        if (!url) {
          setErrorMessage("Playback audio preview is not available for this song.");
          return;
        }
        const audio = new Audio(url);
        audio.onended = () => setPlayingSongId(null);
        audio.play().catch(() => {
          setPlayingSongId(null);
        });
        setAudioElement(audio);
        setPlayingSongId(songId);
      } catch {
        setErrorMessage("Could not load audio preview.");
      }
    }
  };

  // CLIENT APPROVAL ACTIONS
  const handleApprove = async (clientId: string) => {
    setErrorMessage("");
    setSuccessMessage("");
    const libraryId = selectedLibraryMap[clientId];

    try {
      const res = await approveClient(clientId, libraryId);
      if (!res.success) {
        setErrorMessage(res.error || "Approval failed.");
        return;
      }
      setSuccessMessage(
        `Client successfully approved${
          libraryId ? " and assigned to library." : "."
        }`
      );
      await loadData();
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Error executing approval.");
    }
  };

  const handleStartReject = (clientId: string) => {
    setRejectingClientId(clientId);
    setRejectReason("");
  };

  const handleConfirmReject = async () => {
    if (!rejectingClientId) return;
    setErrorMessage("");
    setSuccessMessage("");

    try {
      const res = await rejectClient(rejectingClientId, rejectReason);
      if (!res.success) {
        setErrorMessage(res.error || "Rejection failed.");
        return;
      }
      setSuccessMessage("Client registration rejected.");
      setRejectingClientId(null);
      setRejectReason("");
      await loadData();
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Error executing rejection.");
    }
  };

  const handleAssignLibrary = async (clientId: string, libraryId: string) => {
    setErrorMessage("");
    setSuccessMessage("");

    try {
      const res = await assignClientToLibrary(clientId, libraryId);
      if (!res.success) {
        setErrorMessage(res.error || "Failed to assign library.");
        return;
      }
      setSuccessMessage("Client library assignment updated.");
      await loadData();
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Error assigning library.");
    }
  };

  // LIBRARY CRUD ACTIONS
  const handleSaveLibrary = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage("");
    setSuccessMessage("");
    setSubmittingLibrary(true);

    try {
      if (editingLibraryId) {
        const res = await updateSongLibrary(editingLibraryId, libFormName, libFormDesc);
        if (!res.success || !res.library) {
          setErrorMessage(res.error || "Could not update library.");
          return;
        }
        setSuccessMessage(`Library "${res.library.name}" updated successfully.`);
        setEditingLibraryId(null);
      } else {
        const res = await createSongLibrary(libFormName, libFormDesc);
        if (!res.success || !res.library) {
          setErrorMessage(res.error || "Could not create library.");
          return;
        }
        setSuccessMessage(`Library "${res.library.name}" created successfully.`);
        setIsCreatingLibrary(false);
      }

      setLibFormName("");
      setLibFormDesc("");
      await loadData();
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Error saving library.");
    } finally {
      setSubmittingLibrary(false);
    }
  };

  const handleStartEditLibrary = (lib: SongLibraryRecord) => {
    setEditingLibraryId(lib.id);
    setIsCreatingLibrary(false);
    setLibFormName(lib.name);
    setLibFormDesc(lib.description);
  };

  const handleArchiveLibrary = async (lib: SongLibraryRecord) => {
    if (!lib.isArchived && lib.clientCount > 0) {
      setErrorMessage(
        `Cannot archive library "${lib.name}": There are ${lib.clientCount} clients currently assigned to this library. Please reassign or unassign clients before archiving.`
      );
      return;
    }
    const actionLabel = lib.isArchived ? "unarchive" : "archive";
    if (!confirm(`Are you sure you want to ${actionLabel} the library "${lib.name}"?`)) {
      return;
    }
    setErrorMessage("");
    setSuccessMessage("");

    try {
      const res = await archiveSongLibrary(lib.id, !lib.isArchived);
      if (!res.success) {
        setErrorMessage(res.error || "Could not update archive status.");
        return;
      }
      setSuccessMessage(lib.isArchived ? "Library unarchived." : "Library archived.");
      await loadData();
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Error toggling archive.");
    }
  };

  const handleDeleteLibrary = async (lib: SongLibraryRecord) => {
    if (lib.clientCount > 0) {
      setErrorMessage(
        `Cannot delete library "${lib.name}": There are ${lib.clientCount} clients currently assigned to this library. Please reassign clients before deleting.`
      );
      return;
    }
    if (!confirm(`Are you sure you want to delete the library "${lib.name}"? This action cannot be undone.`)) {
      return;
    }
    setErrorMessage("");
    setSuccessMessage("");

    try {
      const res = await deleteSongLibrary(lib.id);
      if (!res.success) {
        setErrorMessage(res.error || "Could not delete library.");
        return;
      }
      setSuccessMessage(`Library "${lib.name}" deleted successfully.`);
      if (selectedLibraryForSongs?.id === lib.id) {
        setSelectedLibraryForSongs(null);
      }
      await loadData();
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Error deleting library.");
    }
  };

  // SONG CRUD ACTIONS
  const handleSaveSong = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedLibraryForSongs) return;

    setErrorMessage("");
    setSuccessMessage("");
    setSubmittingSong(true);

    try {
      let finalAudioPath = songAudioRef.trim() || undefined;

      // If user uploaded a new audio file, upload to storage bucket
      if (songFile) {
        setUploadingAudio(true);
        const uploadRes = await uploadSongAudio(selectedLibraryForSongs.id, songFile);
        if (!uploadRes.success || !uploadRes.storagePath) {
          setErrorMessage(uploadRes.error || "Failed to upload audio file.");
          setSubmittingSong(false);
          setUploadingAudio(false);
          return;
        }
        finalAudioPath = uploadRes.storagePath;
      }

      if (editingSongId) {
        const res = await updateSong(editingSongId, {
          title: songTitle,
          artist: songArtist,
          eventGroup: songEventGroup,
          audioFileName: finalAudioPath,
        });
        if (!res.success || !res.song) {
          setErrorMessage(res.error || "Failed to update song.");
          return;
        }
        setSuccessMessage(`Song "${res.song.title}" updated.`);
        setEditingSongId(null);
      } else {
        const res = await addSongToLibrary({
          libraryId: selectedLibraryForSongs.id,
          title: songTitle,
          artist: songArtist,
          eventGroup: songEventGroup,
          audioFileName: finalAudioPath,
        });
        if (!res.success || !res.song) {
          setErrorMessage(res.error || "Failed to add song.");
          return;
        }
        setSuccessMessage(`Song "${res.song.title}" added to library.`);
        setIsAddingSong(false);
      }

      setSongTitle("");
      setSongArtist("");
      setSongAudioRef("");
      setSongFile(null);
      setSongEventGroup("Haldi");
      await loadSongs(selectedLibraryForSongs.id);
      await loadData(); // refresh counts
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Error saving song.");
    } finally {
      setSubmittingSong(false);
      setUploadingAudio(false);
    }
  };

  const handleStartEditSong = (song: SongItem) => {
    setEditingSongId(song.id);
    setIsAddingSong(false);
    setSongTitle(song.title);
    setSongArtist(song.artist);
    setSongEventGroup(song.eventGroup);
    setSongAudioRef(song.audioFileName || "");
  };

  const handleDeleteSong = async (songId: string, title: string) => {
    if (!confirm(`Are you sure you want to remove "${title}"?`)) return;
    setErrorMessage("");
    setSuccessMessage("");

    try {
      const res = await deleteSong(songId);
      if (!res.success) {
        setErrorMessage(res.error || "Failed to delete song.");
        return;
      }
      setSuccessMessage(`Song "${title}" removed.`);
      if (selectedLibraryForSongs) {
        await loadSongs(selectedLibraryForSongs.id);
      }
      await loadData();
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Error deleting song.");
    }
  };

  // Filtered clients list
  const filteredClients = clients.filter((c) => {
    const matchesStatus =
      clientStatusFilter === "all" || c.approvalStatus === clientStatusFilter;
    const query = clientSearchQuery.trim().toLowerCase();
    const matchesQuery =
      !query ||
      c.fullName.toLowerCase().includes(query) ||
      c.email.toLowerCase().includes(query) ||
      (c.partnerName && c.partnerName.toLowerCase().includes(query)) ||
      (c.assignedLibraryName && c.assignedLibraryName.toLowerCase().includes(query));
    return matchesStatus && matchesQuery;
  });

  const pendingClientCount = clients.filter((c) => c.approvalStatus === "pending").length;
  const activeLibraries = showArchivedLibraries
    ? libraries
    : libraries.filter((l) => !l.isArchived);

  return (
    <div className="space-y-6">
      {/* Demo Data Banner (Gated behind isMockMode) */}
      {songLibraryConfig.isMockMode && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-900">
          <div className="flex items-center gap-2">
            <span className="flex size-2 rounded-full bg-amber-600 animate-pulse" />
            <span className="font-semibold">Demo Data Mode Active:</span>
            <span>
              All client approvals, libraries, and assignments are running on the isolated mock service layer.
            </span>
          </div>
          <a
            href="/client"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 font-medium text-amber-900 underline hover:text-amber-950"
          >
            <span>Open Client Portal in New Tab</span>
            <ExternalLink className="size-3" />
          </a>
        </div>
      )}

      {/* Main Header with Navigation Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold tracking-tight text-[#343a33]">
            Song Library & Client Approvals
          </h2>
          <p className="mt-0.5 text-xs text-[#76776f]">
            Approve wedding clients, organize custom song libraries, and assign playlists.
          </p>
        </div>

        {/* Tab Controls */}
        <div className="flex items-center gap-2 rounded-xl bg-stone-100 p-1 text-xs">
          <button
            type="button"
            onClick={() => {
              setActiveTab("clients");
              setSelectedLibraryForSongs(null);
            }}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 font-medium transition-all ${
              activeTab === "clients"
                ? "bg-white text-[#343a33] shadow-xs font-semibold"
                : "text-[#76776f] hover:text-[#343a33]"
            }`}
          >
            <Users className="size-3.5" />
            <span>Clients & Approvals</span>
            {pendingClientCount > 0 && (
              <span className="rounded-full bg-amber-100 px-1.5 py-0.2 text-[10px] font-bold text-amber-800">
                {pendingClientCount}
              </span>
            )}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("libraries")}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 font-medium transition-all ${
              activeTab === "libraries"
                ? "bg-white text-[#343a33] shadow-xs font-semibold"
                : "text-[#76776f] hover:text-[#343a33]"
            }`}
          >
            <Library className="size-3.5" />
            <span>Song Libraries ({libraries.length})</span>
          </button>
        </div>
      </div>

      {/* Feedback Alerts */}
      {errorMessage && (
        <div className="flex items-start gap-2.5 rounded-xl border border-rose-200 bg-rose-50 p-4 text-xs text-rose-800">
          <AlertCircle className="size-4 shrink-0 mt-0.5" />
          <div className="flex-1">
            <span className="font-semibold">Action Failed:</span> {errorMessage}
          </div>
          <button
            type="button"
            onClick={() => setErrorMessage("")}
            className="text-rose-600 hover:text-rose-800 font-bold ml-2"
          >
            ×
          </button>
        </div>
      )}

      {successMessage && (
        <div className="flex items-start gap-2.5 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-xs text-emerald-800">
          <CheckCircle2 className="size-4 shrink-0 mt-0.5" />
          <div className="flex-1 font-medium">{successMessage}</div>
          <button
            type="button"
            onClick={() => setSuccessMessage("")}
            className="text-emerald-600 hover:text-emerald-800 font-bold ml-2"
          >
            ×
          </button>
        </div>
      )}

      {/* TAB 1: CLIENTS & APPROVALS */}
      {activeTab === "clients" && (
        <div className="space-y-4">
          {/* Filter Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#e9e7df] bg-white p-3 shadow-2xs">
            <div className="relative flex-1 min-w-[220px]">
              <Search className="absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-[#a09d93]" />
              <Input
                placeholder="Search clients by name, partner, email, or library..."
                value={clientSearchQuery}
                onChange={(e) => setClientSearchQuery(e.target.value)}
                className="h-8 pl-8 text-xs border-[#e6e4dd]"
              />
            </div>

            <div className="flex items-center gap-1.5 text-xs">
              <span className="text-[#89887e]">Status:</span>
              {(["all", "pending", "approved", "rejected"] as const).map((status) => (
                <button
                  key={status}
                  type="button"
                  onClick={() => setClientStatusFilter(status)}
                  className={`capitalize rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                    clientStatusFilter === status
                      ? "bg-[#344234] text-white"
                      : "bg-[#f8f7f4] text-[#76776f] hover:bg-[#edeae2]"
                  }`}
                >
                  {status}
                </button>
              ))}
              <Button
                variant="ghost"
                size="sm"
                onClick={loadData}
                disabled={loading}
                className="h-7 text-xs text-[#76776f] hover:text-[#343a33]"
              >
                <RefreshCw className={`size-3 mr-1 ${loading ? "animate-spin" : ""}`} />
                Refresh
              </Button>
            </div>
          </div>

          {/* Rejection Modal / Dialog Box */}
          {rejectingClientId && (
            <div className="rounded-2xl border border-rose-200 bg-rose-50/60 p-4 shadow-sm space-y-3">
              <div className="flex items-center gap-2 text-rose-900 font-medium text-xs">
                <AlertCircle className="size-4 text-rose-700" />
                <span>
                  Provide an optional reason for declining client registration (shown to the client on their rejected screen):
                </span>
              </div>
              <Input
                placeholder="e.g. Incomplete booking details, please verify your shoot contract."
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                className="text-xs bg-white border-rose-200"
              />
              <div className="flex justify-end gap-2">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setRejectingClientId(null)}
                  className="h-7 text-xs text-stone-600"
                >
                  Cancel
                </Button>
                <Button
                  size="sm"
                  onClick={handleConfirmReject}
                  className="h-7 bg-rose-700 hover:bg-rose-800 text-white text-xs px-3 rounded-lg"
                >
                  Confirm Rejection
                </Button>
              </div>
            </div>
          )}

          {/* Clients Table */}
          <div className="rounded-2xl border border-[#e9e7df] bg-white shadow-2xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-[#e9e7df] bg-[#f8f7f4] font-medium text-[#76776f]">
                  <tr>
                    <th className="px-4 py-3">Couple / Client</th>
                    <th className="px-4 py-3">Contact</th>
                    <th className="px-4 py-3">Wedding Date</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Assigned Library</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#f1eee6]">
                  {filteredClients.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-[#89887e]">
                        {loading ? "Loading clients..." : "No client registrations match the filter."}
                      </td>
                    </tr>
                  ) : (
                    filteredClients.map((client) => {
                      const isPending = client.approvalStatus === "pending";
                      const isApproved = client.approvalStatus === "approved";
                      const isRejected = client.approvalStatus === "rejected";

                      return (
                        <tr key={client.id} className="hover:bg-[#faf9f6] transition-colors">
                          <td className="px-4 py-3.5">
                            <div className="font-semibold text-[#343a33]">{client.fullName}</div>
                            {client.partnerName && (
                              <div className="text-[11px] text-[#76776f]">
                                &amp; {client.partnerName}
                              </div>
                            )}
                          </td>

                          <td className="px-4 py-3.5 text-[#555951]">
                            <div>{client.email}</div>
                            {client.phone && (
                              <div className="text-[11px] text-[#89887e]">{client.phone}</div>
                            )}
                          </td>

                          <td className="px-4 py-3.5 text-[#555951]">
                            {client.weddingDate ? (
                              <div className="flex items-center gap-1">
                                <Calendar className="size-3 text-[#99968c]" />
                                <span>{client.weddingDate}</span>
                              </div>
                            ) : (
                              <span className="text-[#a09d93]">Not set</span>
                            )}
                          </td>

                          <td className="px-4 py-3.5">
                            {isPending && (
                              <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-800">
                                <Clock3 className="size-3" /> Pending Review
                              </span>
                            )}
                            {isApproved && (
                              <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-800">
                                <CheckCircle2 className="size-3" /> Approved
                              </span>
                            )}
                            {isRejected && (
                              <div>
                                <span className="inline-flex items-center gap-1 rounded-full border border-rose-200 bg-rose-50 px-2 py-0.5 text-[11px] font-medium text-rose-800">
                                  <XCircle className="size-3" /> Rejected
                                </span>
                                {client.rejectionReason && (
                                  <div className="text-[10px] text-rose-700 italic mt-0.5 max-w-[180px] truncate" title={client.rejectionReason}>
                                    Reason: {client.rejectionReason}
                                  </div>
                                )}
                              </div>
                            )}
                          </td>

                          <td className="px-4 py-3.5">
                            {isApproved ? (
                              <select
                                value={client.assignedLibraryId || ""}
                                onChange={(e) => handleAssignLibrary(client.id, e.target.value)}
                                className="h-8 rounded-lg border border-[#dedbd2] bg-white px-2 py-1 text-xs text-[#343a33] focus:border-[#344234] focus:outline-hidden"
                              >
                                <option value="" disabled>Select Library</option>
                                {libraries
                                  .filter((l) => !l.isArchived)
                                  .map((lib) => (
                                    <option key={lib.id} value={lib.id}>
                                      {lib.name} ({lib.songCount} songs)
                                    </option>
                                  ))}
                              </select>
                            ) : isPending ? (
                              <select
                                value={selectedLibraryMap[client.id] || (libraries[0]?.id || "")}
                                onChange={(e) =>
                                  setSelectedLibraryMap((prev) => ({
                                    ...prev,
                                    [client.id]: e.target.value,
                                  }))
                                }
                                className="h-8 rounded-lg border border-amber-200 bg-amber-50/50 px-2 py-1 text-xs text-amber-900 focus:border-amber-400 focus:outline-hidden"
                              >
                                {libraries
                                  .filter((l) => !l.isArchived)
                                  .map((lib) => (
                                    <option key={lib.id} value={lib.id}>
                                      Assign: {lib.name}
                                    </option>
                                  ))}
                              </select>
                            ) : (
                              <span className="text-[#a09d93]">None</span>
                            )}
                          </td>

                          <td className="px-4 py-3.5 text-right space-x-1.5 whitespace-nowrap">
                            {isPending && (
                              <>
                                <Button
                                  size="sm"
                                  onClick={() => handleApprove(client.id)}
                                  className="h-7 bg-[#344234] hover:bg-[#283528] text-white text-xs px-2.5 rounded-lg"
                                >
                                  <CheckCircle2 className="size-3 mr-1" />
                                  Approve
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleStartReject(client.id)}
                                  className="h-7 border-rose-200 text-rose-700 hover:bg-rose-50 text-xs px-2.5 rounded-lg"
                                >
                                  <XCircle className="size-3 mr-1" />
                                  Reject
                                </Button>
                              </>
                            )}

                            {isRejected && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleApprove(client.id)}
                                className="h-7 border-[#dedbd2] text-[#344234] hover:bg-[#f1eee6] text-xs px-2.5 rounded-lg"
                              >
                                <RefreshCw className="size-3 mr-1" />
                                Re-approve
                              </Button>
                            )}

                            {isApproved && (
                              <span className="text-[11px] text-[#89887e]">
                                Reviewed by {client.reviewedBy || "Studio"}
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: SONG LIBRARIES & SONGS MANAGEMENT */}
      {activeTab === "libraries" && (
        <div className="space-y-5">
          {/* VIEW A: Browsing / Managing songs inside a specific library */}
          {selectedLibraryForSongs ? (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#e9e7df] pb-4">
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setSelectedLibraryForSongs(null);
                      setIsAddingSong(false);
                      setEditingSongId(null);
                    }}
                    className="h-8 border-[#dedbd2] text-xs text-[#343a33]"
                  >
                    <ArrowLeft className="size-3.5 mr-1" />
                    Back to Libraries
                  </Button>
                  <div>
                    <h3 className="text-base font-semibold text-[#343a33] flex items-center gap-2">
                      <span>{selectedLibraryForSongs.name}</span>
                      {selectedLibraryForSongs.isArchived && (
                        <span className="rounded-full bg-stone-200 px-2 py-0.5 text-[10px] font-medium text-stone-700">
                          Archived
                        </span>
                      )}
                    </h3>
                    <p className="text-xs text-[#76776f]">{selectedLibraryForSongs.description}</p>
                  </div>
                </div>

                <Button
                  size="sm"
                  onClick={() => {
                    setIsAddingSong(!isAddingSong);
                    setEditingSongId(null);
                    setSongTitle("");
                    setSongArtist("");
                    setSongAudioRef("");
                  }}
                  className="h-8 bg-[#344234] hover:bg-[#283528] text-white text-xs px-3 rounded-lg"
                >
                  <Plus className="size-3.5 mr-1" />
                  {isAddingSong ? "Cancel" : "Add Song to Library"}
                </Button>
              </div>

              {/* Add / Edit Song Form */}
              {(isAddingSong || editingSongId) && (
                <form
                  onSubmit={handleSaveSong}
                  className="rounded-2xl border border-[#dedbd2] bg-white p-5 shadow-xs space-y-3"
                >
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-[#586651]">
                    {editingSongId ? "Edit Song Details" : "Add Song to Library"}
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                    <div>
                      <label className="block text-[11px] font-medium text-[#444941]">
                        Song Title *
                      </label>
                      <Input
                        required
                        placeholder="e.g. Gud Naal Ishq Mitha"
                        value={songTitle}
                        onChange={(e) => setSongTitle(e.target.value)}
                        className="mt-1 text-xs"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-medium text-[#444941]">
                        Artist / Producer *
                      </label>
                      <Input
                        required
                        placeholder="e.g. The Wedding Band feat. Navraj"
                        value={songArtist}
                        onChange={(e) => setSongArtist(e.target.value)}
                        className="mt-1 text-xs"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-medium text-[#444941]">
                        Wedding Event Group *
                      </label>
                      <select
                        value={songEventGroup}
                        onChange={(e) => setSongEventGroup(e.target.value as WeddingEventGroup)}
                        className="mt-1 h-9 w-full rounded-lg border border-[#dedbd2] bg-white px-2 py-1 text-xs text-[#343a33] focus:border-[#344234] focus:outline-hidden"
                      >
                        {WEDDING_EVENT_GROUPS.map((event) => (
                          <option key={event} value={event}>
                            {event}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-[11px] font-medium text-[#444941]">
                        Upload Audio File (.mp3, .wav, .m4a)
                      </label>
                      <Input
                        type="file"
                        accept="audio/*"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            setSongFile(file);
                            setSongAudioRef(file.name);
                          }
                        }}
                        className="mt-1 text-xs"
                      />
                      {songAudioRef && (
                        <span className="text-[10px] text-stone-500 font-mono mt-0.5 block truncate">
                          {songFile ? `Selected file: ${songFile.name}` : `Path: ${songAudioRef}`}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex justify-end gap-2 pt-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setIsAddingSong(false);
                        setEditingSongId(null);
                      }}
                      className="h-8 text-xs text-[#76776f]"
                    >
                      Cancel
                    </Button>
                    <Button
                      type="submit"
                      disabled={submittingSong}
                      size="sm"
                      className="h-8 bg-[#344234] hover:bg-[#283528] text-white text-xs px-4"
                    >
                      {submittingSong ? "Saving..." : editingSongId ? "Update Song" : "Add Song"}
                    </Button>
                  </div>
                </form>
              )}

              {/* Grouped Songs by 12 Wedding Event Groups */}
              <div className="space-y-6">
                {loadingSongs ? (
                  <div className="py-12 text-center text-xs text-[#89887e]">
                    Loading songs in library...
                  </div>
                ) : librarySongs.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-[#dedbd2] p-8 text-center text-xs text-[#89887e]">
                    No songs in this library yet. Click &quot;Add Song to Library&quot; above to add your first track.
                  </div>
                ) : (
                  WEDDING_EVENT_GROUPS.map((eventGroup) => {
                    const eventSongs = librarySongs.filter((s) => s.eventGroup === eventGroup);
                    if (eventSongs.length === 0) return null;

                    return (
                      <div key={eventGroup} className="rounded-2xl border border-[#e9e7df] bg-white overflow-hidden shadow-2xs">
                        <div className="border-b border-[#e9e7df] bg-[#f8f7f4] px-4 py-2.5 flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-xs text-[#343a33]">{eventGroup}</span>
                            <span className="rounded-full bg-[#e8e6dc] px-2 py-0.5 text-[10px] font-medium text-[#52574e]">
                              {eventSongs.length} {eventSongs.length === 1 ? "song" : "songs"}
                            </span>
                          </div>
                        </div>

                        <div className="divide-y divide-[#f1eee6]">
                          {eventSongs.map((song) => (
                            <div
                              key={song.id}
                              className="px-4 py-3 flex items-center justify-between hover:bg-[#faf9f6] transition-colors gap-3"
                            >
                              <div className="flex items-center gap-3 min-w-0">
                                <button
                                  type="button"
                                  onClick={() => handleTogglePlay(song.id, song.audioFileName)}
                                  className={`flex size-8 shrink-0 items-center justify-center rounded-full transition-colors ${
                                    playingSongId === song.id
                                      ? "bg-[#344234] text-white"
                                      : "bg-[#f1eee6] text-[#444941] hover:bg-[#e4e1d7]"
                                  }`}
                                  title="Play audio preview"
                                >
                                  {playingSongId === song.id ? (
                                    <Pause className="size-3.5" />
                                  ) : (
                                    <Play className="size-3.5 ml-0.5" />
                                  )}
                                </button>
                                <div className="min-w-0">
                                  <p className="text-xs font-semibold text-[#343a33] truncate">
                                    {song.title}
                                  </p>
                                  <p className="text-[11px] text-[#76776f] truncate">
                                    {song.artist} · <span className="text-[#a09d93]">{song.durationFormatted}</span>
                                    {song.audioFileName && (
                                      <span className="ml-2 font-mono text-[10px] text-stone-400">
                                        ({song.audioFileName})
                                      </span>
                                    )}
                                  </p>
                                </div>
                              </div>

                              <div className="flex items-center gap-1 shrink-0">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleStartEditSong(song)}
                                  className="h-7 w-7 p-0 text-[#76776f] hover:text-[#343a33]"
                                  title="Edit song"
                                >
                                  <Edit2 className="size-3.5" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleDeleteSong(song.id, song.title)}
                                  className="h-7 w-7 p-0 text-[#76776f] hover:text-rose-600"
                                  title="Delete song"
                                >
                                  <Trash2 className="size-3.5" />
                                </Button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          ) : (
            /* VIEW B: List of all libraries */
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <p className="text-xs text-[#76776f]">
                    Libraries group wedding soundtracks for clients. Create custom collections for different wedding styles.
                  </p>
                  <label className="flex items-center gap-1.5 text-xs text-[#76776f] cursor-pointer ml-3">
                    <input
                      type="checkbox"
                      checked={showArchivedLibraries}
                      onChange={(e) => setShowArchivedLibraries(e.target.checked)}
                      className="rounded border-[#dedbd2] text-[#344234]"
                    />
                    <span>Show Archived</span>
                  </label>
                </div>

                <Button
                  size="sm"
                  onClick={() => {
                    setIsCreatingLibrary(!isCreatingLibrary);
                    setEditingLibraryId(null);
                    setLibFormName("");
                    setLibFormDesc("");
                  }}
                  className="h-8 bg-[#344234] hover:bg-[#283528] text-white text-xs px-3 rounded-lg"
                >
                  <Plus className="size-3.5 mr-1" />
                  {isCreatingLibrary ? "Cancel" : "Create New Library"}
                </Button>
              </div>

              {/* Create or Edit Library Form */}
              {(isCreatingLibrary || editingLibraryId) && (
                <form
                  onSubmit={handleSaveLibrary}
                  className="rounded-2xl border border-[#dedbd2] bg-white p-5 shadow-xs space-y-3"
                >
                  <h3 className="text-sm font-semibold text-[#343a33] flex items-center gap-1.5">
                    <FolderPlus className="size-4 text-[#586651]" />
                    {editingLibraryId ? "Edit Song Library" : "Create New Wedding Song Library"}
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-medium text-[#444941]">
                        Library Name *
                      </label>
                      <Input
                        required
                        placeholder="e.g. Royal Heritage Collection"
                        value={libFormName}
                        onChange={(e) => setLibFormName(e.target.value)}
                        className="mt-1 text-xs"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-medium text-[#444941]">
                        Description
                      </label>
                      <Input
                        placeholder="e.g. Traditional shehnai and grand entrance anthems"
                        value={libFormDesc}
                        onChange={(e) => setLibFormDesc(e.target.value)}
                        className="mt-1 text-xs"
                      />
                    </div>
                  </div>
                  <div className="flex justify-end gap-2 pt-2">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setIsCreatingLibrary(false);
                        setEditingLibraryId(null);
                      }}
                      className="h-8 text-xs text-[#76776f]"
                    >
                      Cancel
                    </Button>
                    <Button
                      type="submit"
                      disabled={submittingLibrary}
                      size="sm"
                      className="h-8 bg-[#344234] hover:bg-[#283528] text-white text-xs px-4"
                    >
                      {submittingLibrary
                        ? "Saving..."
                        : editingLibraryId
                        ? "Update Library"
                        : "Save Library"}
                    </Button>
                  </div>
                </form>
              )}

              {/* Library Cards Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {activeLibraries.map((lib) => (
                  <div
                    key={lib.id}
                    className={`flex flex-col justify-between rounded-2xl border p-5 shadow-2xs transition-all ${
                      lib.isArchived
                        ? "border-stone-200 bg-stone-50/70 opacity-75"
                        : "border-[#e9e7df] bg-white hover:shadow-xs"
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between">
                        <div className="flex size-8 items-center justify-center rounded-lg bg-[#f4f2eb] text-[#344234]">
                          <Library className="size-4" />
                        </div>
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => handleStartEditLibrary(lib)}
                            className="text-[#99968c] hover:text-[#343a33] p-1 transition-colors"
                            title="Edit library name/description"
                          >
                            <Edit2 className="size-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleArchiveLibrary(lib)}
                            className="text-[#99968c] hover:text-[#343a33] p-1 transition-colors"
                            title={lib.isArchived ? "Unarchive library" : "Archive library"}
                          >
                            {lib.isArchived ? (
                              <ArchiveRestore className="size-3.5 text-amber-700" />
                            ) : (
                              <Archive className="size-3.5" />
                            )}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteLibrary(lib)}
                            className="text-[#99968c] hover:text-rose-600 p-1 transition-colors"
                            title="Delete library"
                          >
                            <Trash2 className="size-3.5" />
                          </button>
                        </div>
                      </div>

                      <h4 className="mt-3 text-sm font-semibold text-[#343a33] flex items-center gap-2">
                        <span>{lib.name}</span>
                        {lib.isArchived && (
                          <span className="rounded-full bg-stone-200 px-2 py-0.2 text-[10px] font-medium text-stone-700">
                            Archived
                          </span>
                        )}
                      </h4>
                      <p className="mt-1 text-xs text-[#76776f] line-clamp-2 leading-relaxed">
                        {lib.description}
                      </p>
                    </div>

                    <div className="mt-5 pt-3 border-t border-[#f1eee6] flex items-center justify-between">
                      <div className="flex items-center gap-3 text-xs text-[#89887e]">
                        <span className="inline-flex items-center gap-1 font-medium text-[#444941]">
                          <Music2 className="size-3.5 text-[#586651]" />
                          {lib.songCount} songs
                        </span>
                        <span className="inline-flex items-center gap-1 font-medium text-[#444941]">
                          <Users className="size-3.5 text-[#586651]" />
                          {lib.clientCount} clients
                        </span>
                      </div>

                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setSelectedLibraryForSongs(lib)}
                        className="h-7 border-[#dedbd2] hover:bg-[#f1eee6] text-xs px-2.5 text-[#343a33]"
                      >
                        Manage Songs
                        <ChevronRight className="size-3 ml-1" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
