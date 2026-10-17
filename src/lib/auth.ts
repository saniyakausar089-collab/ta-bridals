import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export type UserRole = "admin" | "team_member" | "client";
export type ApprovalStatus = "pending" | "approved" | "rejected";
export type AccessStatus = "checking" | "allowed" | "pending" | "rejected" | "signed-out";

export interface UserAccessResult {
  status: AccessStatus;
  role: UserRole | null;
  isAdmin: boolean;
  isApproved: boolean;
  displayName: string;
  email: string;
  errorMessage?: string;
}

export interface ProfileRecord {
  user_id: string;
  display_name: string;
  email: string | null;
  approval_status: ApprovalStatus;
  reviewed_at: string | null;
  reviewed_by: string | null;
  created_at: string;
  updated_at: string;
}

const OWNER_EMAILS = [
  "saniyakausar089@gmail.com",
  "admin@tabridals.com",
  "admin@123.com",
  "admin@123",
];

export function isOwnerEmail(email?: string | null): boolean {
  const normalized = (email ?? "").trim().toLowerCase();
  return OWNER_EMAILS.includes(normalized);
}

/**
 * Checks the authenticated user's access level and approval status.
 * Enforces admin vs approved team member vs pending vs rejected.
 */
export async function checkUserAccess(session: Session | null): Promise<UserAccessResult> {
  if (!session?.user) {
    return {
      status: "signed-out",
      role: null,
      isAdmin: false,
      isApproved: false,
      displayName: "",
      email: "",
    };
  }

  const user = session.user;
  const userEmail = (user.email ?? "").toLowerCase();

  // The primary owner account always has administrative owner access
  const isOwner = isOwnerEmail(userEmail);

  try {
    const [rolesResult, profileResult] = await Promise.all([
      supabase.from("user_roles").select("role").eq("user_id", user.id),
      supabase.from("profiles").select("*").eq("user_id", user.id).maybeSingle(),
    ]);

    const roles = (rolesResult.data ?? []).map((r) => r.role as string);
    const hasAdminRole = roles.includes("admin") || isOwner;
    const hasTeamRole = roles.includes("team_member");

    const profile = profileResult.data as
      (ProfileRecord & { display_name?: string; approval_status?: ApprovalStatus }) | null;
    const displayName =
      profile?.display_name ||
      user.user_metadata?.full_name ||
      user.user_metadata?.display_name ||
      userEmail.split("@")[0] ||
      (hasAdminRole ? "Studio owner" : "Team member");

    // 1. Studio owner account always retains administrative access
    if (isOwner) {
      return {
        status: "allowed",
        role: "admin",
        isAdmin: true,
        isApproved: true,
        displayName: displayName || "Studio owner",
        email: userEmail,
      };
    }

    // 2. For all other users, check approval status BEFORE granting any role
    const rawStatus = (profile?.approval_status as ApprovalStatus) || "pending";

    // If profile is missing or marked rejected, strictly block access
    if (rawStatus === "rejected") {
      return {
        status: "rejected",
        role: null,
        isAdmin: false,
        isApproved: false,
        displayName,
        email: userEmail,
      };
    }

    // If profile is missing or marked pending, keep in pending state
    if (rawStatus === "pending" || !profile) {
      return {
        status: "pending",
        role: null,
        isAdmin: false,
        isApproved: false,
        displayName,
        email: userEmail,
      };
    }

    // 3. The user's approval_status is 'approved' - now evaluate role
    if (hasAdminRole) {
      return {
        status: "allowed",
        role: "admin",
        isAdmin: true,
        isApproved: true,
        displayName,
        email: userEmail,
      };
    }

    if (roles.includes("client")) {
      return {
        status: "allowed",
        role: "client",
        isAdmin: false,
        isApproved: true,
        displayName,
        email: userEmail,
      };
    }

    // Default approved role is team member
    return {
      status: "allowed",
      role: "team_member",
      isAdmin: false,
      isApproved: true,
      displayName,
      email: userEmail,
    };
  } catch (error) {
    // If table fetch failed, check if it's the owner account as a failsafe
    if (isOwner) {
      return {
        status: "allowed",
        role: "admin",
        isAdmin: true,
        isApproved: true,
        displayName: "Studio owner",
        email: userEmail,
      };
    }

    return {
      status: "pending",
      role: null,
      isAdmin: false,
      isApproved: false,
      displayName: userEmail.split("@")[0] || "Team applicant",
      email: userEmail,
      errorMessage: error instanceof Error ? error.message : "Failed to verify access level.",
    };
  }
}

export interface SignUpParams {
  fullName: string;
  email: string;
  password: string;
  confirmPassword: string;
}

export interface SignUpResult {
  success: boolean;
  requiresEmailConfirmation: boolean;
  user: User | null;
  message?: string;
  error?: string;
}

/**
 * Registers a new user with Supabase Auth.
 * Sanitizes input, enforces password match and minimum length, and handles duplicate registrations.
 */
export async function signUpTeamMember({
  fullName,
  email,
  password,
  confirmPassword,
}: SignUpParams): Promise<SignUpResult> {
  const trimmedName = fullName.trim();
  const trimmedEmail = email.trim().toLowerCase();

  if (!trimmedName) {
    return {
      success: false,
      requiresEmailConfirmation: false,
      user: null,
      error: "Please enter your full name.",
    };
  }

  if (!trimmedEmail || !trimmedEmail.includes("@")) {
    return {
      success: false,
      requiresEmailConfirmation: false,
      user: null,
      error: "Please enter a valid email address.",
    };
  }

  if (password.length < 6) {
    return {
      success: false,
      requiresEmailConfirmation: false,
      user: null,
      error: "Password must be at least 6 characters long.",
    };
  }

  if (password !== confirmPassword) {
    return {
      success: false,
      requiresEmailConfirmation: false,
      user: null,
      error: "Passwords do not match.",
    };
  }

  // Ensure public signup NEVER assigns admin role
  const { data, error } = await supabase.auth.signUp({
    email: trimmedEmail,
    password,
    options: {
      data: {
        full_name: trimmedName,
        display_name: trimmedName,
      },
    },
  });

  if (error) {
    const errorLower = error.message.toLowerCase();
    if (
      errorLower.includes("already registered") ||
      errorLower.includes("unique constraint") ||
      errorLower.includes("already in use")
    ) {
      return {
        success: false,
        requiresEmailConfirmation: false,
        user: null,
        error: "An account with this email address already exists. Please sign in instead.",
      };
    }
    return {
      success: false,
      requiresEmailConfirmation: false,
      user: null,
      error: error.message,
    };
  }

  // Detect duplicate registrations where Supabase returns obfuscated empty identities
  if (data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
    return {
      success: false,
      requiresEmailConfirmation: false,
      user: null,
      error: "An account with this email address already exists. Please sign in instead.",
    };
  }

  const requiresEmailConfirmation = !data.session && !!data.user;

  return {
    success: true,
    requiresEmailConfirmation,
    user: data.user,
    message: requiresEmailConfirmation
      ? "Account created! Please check your inbox to confirm your email. Once confirmed, your registration will be reviewed by the studio owner."
      : "Account created successfully! Your registration is awaiting owner approval.",
  };
}

/**
 * Approve a pending registration (Admin only).
 * Grants the user 'team_member' access and updates their approval status.
 */
export async function approveRegistration(
  userId: string,
  role: string = "team_member",
): Promise<{ error: string | null }> {
  // First attempt RPC if available
  try {
    const { error: rpcError } = await supabase.rpc("approve_user_registration", {
      p_user_id: userId,
      p_role: role,
    });

    if (!rpcError) return { error: null };
    // If function doesn't exist or error, fallback to direct table updates
  } catch {
    // Continue to fallback
  }

  try {
    const { error: profileError } = await supabase
      .from("profiles")
      .update({
        approval_status: "approved",
        reviewed_at: new Date().toISOString(),
      })
      .eq("user_id", userId);

    if (profileError) return { error: profileError.message };

    const { error: roleError } = await supabase
      .from("user_roles")
      .upsert({ user_id: userId, role: "team_member" }, { onConflict: "user_id,role" });

    if (roleError) return { error: roleError.message };

    return { error: null };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Failed to approve user." };
  }
}

/**
 * Reject a registration (Admin only).
 */
export async function rejectRegistration(userId: string): Promise<{ error: string | null }> {
  try {
    const { error: rpcError } = await supabase.rpc("reject_user_registration", {
      p_user_id: userId,
    });

    if (!rpcError) return { error: null };
  } catch {
    // Fallback
  }

  try {
    const { error: profileError } = await supabase
      .from("profiles")
      .update({
        approval_status: "rejected",
        reviewed_at: new Date().toISOString(),
      })
      .eq("user_id", userId);

    if (profileError) return { error: profileError.message };

    // Remove any team_member role
    await supabase.from("user_roles").delete().eq("user_id", userId).eq("role", "team_member");

    return { error: null };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Failed to reject registration." };
  }
}
