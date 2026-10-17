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
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { songLibraryConfig } from "@/config/songLibraryConfig";
import {
  clientLogin,
  clientSignUp,
  clientSignOut,
  getClientSession,
  refreshClientStatus,
  DEMO_CLIENT_ACCOUNTS,
} from "@/lib/songLibraryService";
import type { ClientProfile, ClientApprovalStatus } from "@/types/songLibrary";

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
    const current = getClientSession();
    setSession(current);
    setLoading(false);
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

  const handleSignOut = () => {
    clientSignOut();
    setSession(null);
    setLoginPassword("");
    setAuthError("");
    setSuccessNotice("");
  };

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
                Your wedding music registration has been submitted. The studio owner reviews all client
                accounts before granting access to your assigned wedding song library.
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
                Your client registration could not be approved at this time. If you believe this is an
                error or if you have booked a shoot with TA Bridals under a different email, please contact
                your studio manager directly.
              </p>
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
                onClick={handleSignOut}
                className="border-stone-200 text-xs text-stone-700"
              >
                <LogOut className="size-3.5 mr-1" />
                Sign Out
              </Button>
            </div>
          </div>
        </header>

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
                  {" "}You have been assigned to the{" "}
                  <strong>{session.assignedLibraryName}</strong>.
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

            <div className="mt-8 border-t border-stone-100 pt-6">
              <p className="text-xs text-stone-400">
                Step 1 Complete: Client auth, pending guard, and role separation are verified.
                Full interactive song browsing, playback, and pick submission will connect in Step 5.
              </p>
            </div>
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
