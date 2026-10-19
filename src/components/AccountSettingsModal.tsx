import React, { useState } from "react";
import { X, User, Lock, CheckCircle2, AlertCircle, KeyRound, Shield, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { updateUserDisplayName, updateUserPassword } from "@/lib/auth";
import { updateClientProfileName } from "@/lib/songLibraryService";

interface AccountSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentName: string;
  userEmail: string;
  role: "admin" | "worker" | "client";
  clientId?: string;
  onNameUpdated?: (newName: string) => void;
}

export function AccountSettingsModal({
  isOpen,
  onClose,
  currentName,
  userEmail,
  role,
  clientId,
  onNameUpdated,
}: AccountSettingsModalProps) {
  const [activeTab, setActiveTab] = useState<"profile" | "password">("profile");

  // Name state
  const [name, setName] = useState(currentName);
  const [partnerName, setPartnerName] = useState("");
  const [nameSaving, setNameSaving] = useState(false);
  const [nameMessage, setNameMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  // Password state
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordMessage, setPasswordMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  if (!isOpen) return null;

  const handleUpdateName = async (e: React.FormEvent) => {
    e.preventDefault();
    setNameMessage(null);
    if (!name.trim()) {
      setNameMessage({ type: "error", text: "Name cannot be empty." });
      return;
    }

    setNameSaving(true);
    try {
      if (role === "client" && clientId) {
        const res = await updateClientProfileName(
          clientId,
          name.trim(),
          partnerName.trim() || undefined,
        );
        if (!res.success) {
          setNameMessage({ type: "error", text: res.error || "Failed to update client name." });
          return;
        }
      } else {
        const res = await updateUserDisplayName(name.trim());
        if (!res.success) {
          setNameMessage({ type: "error", text: res.error || "Failed to update profile name." });
          return;
        }
      }

      setNameMessage({ type: "success", text: "Your name has been updated successfully!" });
      onNameUpdated?.(name.trim());
    } catch (err) {
      setNameMessage({
        type: "error",
        text: err instanceof Error ? err.message : "Error updating name.",
      });
    } finally {
      setNameSaving(false);
    }
  };

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordMessage(null);

    if (!currentPassword) {
      setPasswordMessage({ type: "error", text: "Please enter your current password first." });
      return;
    }
    if (!newPassword || newPassword.length < 6) {
      setPasswordMessage({
        type: "error",
        text: "New password must be at least 6 characters long.",
      });
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordMessage({ type: "error", text: "New passwords do not match." });
      return;
    }
    if (currentPassword === newPassword) {
      setPasswordMessage({
        type: "error",
        text: "New password must be different from current password.",
      });
      return;
    }

    setPasswordSaving(true);
    try {
      const res = await updateUserPassword({
        currentPassword,
        newPassword,
        confirmNewPassword: confirmPassword,
      });

      if (!res.success) {
        setPasswordMessage({
          type: "error",
          text: res.error || "Failed to change password. Please check your current password.",
        });
        return;
      }

      setPasswordMessage({
        type: "success",
        text: "Password changed successfully! Keep your new credentials safe.",
      });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err) {
      setPasswordMessage({
        type: "error",
        text: err instanceof Error ? err.message : "Error changing password.",
      });
    } finally {
      setPasswordSaving(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="account-settings-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs"
    >
      <div className="relative w-full max-w-md overflow-hidden rounded-2xl border border-[#30282e] bg-[#151317] text-[#f7f0ee] shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#30282e] px-6 py-4.5 bg-[#19151c]">
          <div className="flex items-center gap-2.5">
            <div className="flex size-9 items-center justify-center rounded-xl bg-[#762d40]/30 text-[#e7a0ad] border border-[#762d40]/50">
              <Shield className="size-4.5" />
            </div>
            <div>
              <h2
                id="account-settings-title"
                className="text-base font-serif font-semibold text-[#f7f0ee]"
              >
                Account Settings
              </h2>
              <p className="text-[11px] text-[#b8adb2]">
                {role === "admin"
                  ? "Studio Administrator"
                  : role === "worker"
                    ? "Team Member / Worker"
                    : "Wedding Client"}{" "}
                · {userEmail}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-[#b8adb2] hover:bg-white/10 hover:text-white transition-colors"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Tab navigation */}
        <div className="flex border-b border-[#30282e] bg-[#120f13]">
          <button
            type="button"
            onClick={() => setActiveTab("profile")}
            className={`flex-1 py-3 text-xs font-medium text-center transition-colors border-b-2 flex items-center justify-center gap-2 ${
              activeTab === "profile"
                ? "border-[#c56c7d] text-[#e7a0ad] bg-[#19151c]"
                : "border-transparent text-[#b8adb2] hover:text-[#f7f0ee]"
            }`}
          >
            <User className="size-3.5" />
            Profile Name
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("password")}
            className={`flex-1 py-3 text-xs font-medium text-center transition-colors border-b-2 flex items-center justify-center gap-2 ${
              activeTab === "password"
                ? "border-[#c56c7d] text-[#e7a0ad] bg-[#19151c]"
                : "border-transparent text-[#b8adb2] hover:text-[#f7f0ee]"
            }`}
          >
            <KeyRound className="size-3.5" />
            Change Password
          </button>
        </div>

        {/* Tab Body */}
        <div className="p-6">
          {activeTab === "profile" && (
            <form onSubmit={handleUpdateName} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-[#b8adb2] mb-1.5">
                  Display Name
                </label>
                <div className="relative">
                  <Input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Enter your name"
                    required
                    className="bg-[#1b181d] border-[#30282e] text-[#f7f0ee] placeholder:text-[#82767d] h-10 text-sm focus:border-[#c56c7d]"
                  />
                </div>
              </div>

              {role === "client" && (
                <div>
                  <label className="block text-xs font-medium text-[#b8adb2] mb-1.5">
                    Partner Name (Optional)
                  </label>
                  <Input
                    type="text"
                    value={partnerName}
                    onChange={(e) => setPartnerName(e.target.value)}
                    placeholder="Partner name"
                    className="bg-[#1b181d] border-[#30282e] text-[#f7f0ee] placeholder:text-[#82767d] h-10 text-sm focus:border-[#c56c7d]"
                  />
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-[#b8adb2] mb-1.5">
                  Email Address
                </label>
                <Input
                  type="text"
                  value={userEmail}
                  disabled
                  className="bg-[#100d10] border-[#30282e]/60 text-[#82767d] h-10 text-sm cursor-not-allowed"
                />
                <span className="text-[10px] text-[#82767d] mt-1 block">
                  Email is linked to your studio credentials and cannot be changed here.
                </span>
              </div>

              {nameMessage && (
                <div
                  className={`flex items-start gap-2 rounded-xl p-3 text-xs ${
                    nameMessage.type === "success"
                      ? "border border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
                      : "border border-rose-500/30 bg-rose-500/10 text-rose-300"
                  }`}
                >
                  {nameMessage.type === "success" ? (
                    <CheckCircle2 className="size-4 shrink-0 mt-0.5" />
                  ) : (
                    <AlertCircle className="size-4 shrink-0 mt-0.5" />
                  )}
                  <span>{nameMessage.text}</span>
                </div>
              )}

              <div className="pt-2 flex justify-end gap-2.5">
                <Button
                  type="button"
                  variant="outline"
                  onClick={onClose}
                  className="border-[#30282e] bg-transparent text-[#b8adb2] hover:bg-white/5 text-xs h-9 px-4 rounded-lg"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={nameSaving}
                  className="bg-[#c56c7d] hover:bg-[#b05869] text-white text-xs h-9 px-5 rounded-lg font-medium"
                >
                  {nameSaving ? (
                    <span className="flex items-center gap-1.5">
                      <Loader2 className="size-3.5 animate-spin" /> Saving...
                    </span>
                  ) : (
                    "Save Changes"
                  )}
                </Button>
              </div>
            </form>
          )}

          {activeTab === "password" && (
            <form onSubmit={handleUpdatePassword} className="space-y-4">
              <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-3 text-xs text-amber-200/90 leading-relaxed">
                <p className="font-medium text-amber-200">Security Verification Required</p>
                <p className="text-[11px] text-amber-300/80 mt-0.5">
                  Please type your current password to authorize setting a new password.
                </p>
              </div>

              <div>
                <label className="block text-xs font-medium text-[#b8adb2] mb-1.5">
                  Current Password <span className="text-rose-400">*</span>
                </label>
                <div className="relative">
                  <Input
                    type="password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    placeholder="Enter your existing password"
                    required
                    className="bg-[#1b181d] border-[#30282e] text-[#f7f0ee] placeholder:text-[#82767d] h-10 text-sm focus:border-[#c56c7d]"
                  />
                  <Lock className="absolute right-3 top-1/2 -translate-y-1/2 size-4 text-[#82767d] pointer-events-none" />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-[#b8adb2] mb-1.5">
                  New Password <span className="text-rose-400">*</span>
                </label>
                <Input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Minimum 6 characters"
                  required
                  className="bg-[#1b181d] border-[#30282e] text-[#f7f0ee] placeholder:text-[#82767d] h-10 text-sm focus:border-[#c56c7d]"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-[#b8adb2] mb-1.5">
                  Confirm New Password <span className="text-rose-400">*</span>
                </label>
                <Input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Re-type new password"
                  required
                  className="bg-[#1b181d] border-[#30282e] text-[#f7f0ee] placeholder:text-[#82767d] h-10 text-sm focus:border-[#c56c7d]"
                />
              </div>

              {passwordMessage && (
                <div
                  className={`flex items-start gap-2 rounded-xl p-3 text-xs ${
                    passwordMessage.type === "success"
                      ? "border border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
                      : "border border-rose-500/30 bg-rose-500/10 text-rose-300"
                  }`}
                >
                  {passwordMessage.type === "success" ? (
                    <CheckCircle2 className="size-4 shrink-0 mt-0.5" />
                  ) : (
                    <AlertCircle className="size-4 shrink-0 mt-0.5" />
                  )}
                  <span>{passwordMessage.text}</span>
                </div>
              )}

              <div className="pt-2 flex justify-end gap-2.5">
                <Button
                  type="button"
                  variant="outline"
                  onClick={onClose}
                  className="border-[#30282e] bg-transparent text-[#b8adb2] hover:bg-white/5 text-xs h-9 px-4 rounded-lg"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={passwordSaving}
                  className="bg-[#c56c7d] hover:bg-[#b05869] text-white text-xs h-9 px-5 rounded-lg font-medium"
                >
                  {passwordSaving ? (
                    <span className="flex items-center gap-1.5">
                      <Loader2 className="size-3.5 animate-spin" /> Updating...
                    </span>
                  ) : (
                    "Update Password"
                  )}
                </Button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
