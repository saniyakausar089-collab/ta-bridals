/**
 * TA Bridals - Phone Authentication & Validation Module
 * Handles Indian 10-digit mobile validation, input sanitization,
 * brute-force rate limiting, and Supabase phone+password authentication.
 */

import { supabase } from "@/integrations/supabase/client";

export interface PhoneValidationResult {
  isValid: boolean;
  digits: string;
  formatted: string;
  error?: string;
}

/**
 * Validates an Indian mobile number according to strict requirements:
 * - Exactly 10 numeric digits
 * - Rejects alphabetic characters, special characters, and email addresses
 * - Handles pasted numbers with +91 or 91 country codes or spaces/dashes cleanly
 */
export function validateIndianMobile(rawInput: string): PhoneValidationResult {
  const input = (rawInput ?? "").trim();

  if (!input) {
    return {
      isValid: false,
      digits: "",
      formatted: "",
      error: "Enter your 10-digit mobile number",
    };
  }

  // Reject email addresses explicitly
  if (input.includes("@") || input.includes(".com") || input.includes(".in")) {
    return {
      isValid: false,
      digits: "",
      formatted: "",
      error: "Enter a valid 10-digit mobile number, not an email address",
    };
  }

  // Check for alphabetic characters
  if (/[a-zA-Z]/.test(input)) {
    return {
      isValid: false,
      digits: "",
      formatted: "",
      error: "Enter a valid 10-digit mobile number without letters",
    };
  }

  // Extract all digits
  const allDigits = input.replace(/\D/g, "");

  let normalized = allDigits;
  // If user pasted with India country code +91 (12 digits starting with 91)
  if (allDigits.length === 12 && allDigits.startsWith("91")) {
    normalized = allDigits.slice(2);
  } else if (allDigits.length === 11 && allDigits.startsWith("0")) {
    // Leading trunk 0
    normalized = allDigits.slice(1);
  }

  // Valid Indian mobile numbers are exactly 10 digits
  if (normalized.length < 10) {
    return {
      isValid: false,
      digits: normalized,
      formatted: normalized,
      error: "Enter a valid 10-digit mobile number",
    };
  }

  if (normalized.length > 10) {
    return {
      isValid: false,
      digits: normalized,
      formatted: normalized,
      error: "Enter a valid 10-digit mobile number (maximum 10 digits)",
    };
  }

  // Reject obvious invalid patterns (e.g. all zeros)
  if (/^0+$/.test(normalized)) {
    return {
      isValid: false,
      digits: normalized,
      formatted: normalized,
      error: "Enter a valid 10-digit mobile number",
    };
  }

  // Clean formatting: 5 digits space 5 digits (e.g. 98765 43210)
  const formatted = `${normalized.slice(0, 5)} ${normalized.slice(5)}`;

  return {
    isValid: true,
    digits: normalized,
    formatted,
  };
}

/**
 * Sanitizes input in real time for mobile input fields.
 * Strips non-digits and restricts to at most 10 digits.
 * If user pastes a +91 number, intelligently extracts the 10 digits.
 */
export function sanitizeMobileInput(raw: string): string {
  if (!raw) return "";
  let digits = raw.replace(/\D/g, "");

  // If pasted with country code +91
  if (digits.length === 12 && digits.startsWith("91")) {
    digits = digits.slice(2);
  } else if (digits.length === 11 && digits.startsWith("0")) {
    digits = digits.slice(1);
  }

  return digits.slice(0, 10);
}

// Client-side rate-limiting tracker for brute-force mitigation
const FAILED_ATTEMPTS_KEY = "ta_auth_failed_attempts";
const MAX_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 60 * 1000; // 60 seconds

interface RateLimitState {
  count: number;
  lockoutUntil: number | null;
}

function getRateLimitState(identifier: string): RateLimitState {
  if (typeof window === "undefined") return { count: 0, lockoutUntil: null };
  try {
    const raw = sessionStorage.getItem(`${FAILED_ATTEMPTS_KEY}_${identifier}`);
    if (!raw) return { count: 0, lockoutUntil: null };
    const parsed = JSON.parse(raw);
    if (parsed.lockoutUntil && Date.now() > parsed.lockoutUntil) {
      sessionStorage.removeItem(`${FAILED_ATTEMPTS_KEY}_${identifier}`);
      return { count: 0, lockoutUntil: null };
    }
    return parsed;
  } catch {
    return { count: 0, lockoutUntil: null };
  }
}

function recordFailedAttempt(identifier: string): { locked: boolean; remainingSeconds: number } {
  if (typeof window === "undefined") return { locked: false, remainingSeconds: 0 };
  const current = getRateLimitState(identifier);
  const nextCount = current.count + 1;
  const state: RateLimitState = {
    count: nextCount,
    lockoutUntil: nextCount >= MAX_ATTEMPTS ? Date.now() + LOCKOUT_DURATION_MS : null,
  };
  try {
    sessionStorage.setItem(`${FAILED_ATTEMPTS_KEY}_${identifier}`, JSON.stringify(state));
  } catch {
    // Ignore storage errors
  }
  return {
    locked: nextCount >= MAX_ATTEMPTS,
    remainingSeconds: Math.ceil(LOCKOUT_DURATION_MS / 1000),
  };
}

function resetRateLimit(identifier: string): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.removeItem(`${FAILED_ATTEMPTS_KEY}_${identifier}`);
  } catch {
    // Ignore storage errors
  }
}

export interface SignInWithMobileParams {
  mobileNumber: string;
  password: string;
}

export interface SignInWithMobileResult {
  success: boolean;
  error?: string;
  session?: any;
  user?: any;
}

/**
 * Authenticates user via 10-digit mobile number + password.
 * 1. Strictly validates 10 numeric digits.
 * 2. Enforces client-side rate limiting to prevent brute-force attacks.
 * 3. Resolves registered account email through secure Postgres RPC resolve_auth_email_by_phone.
 * 4. Signs in with Supabase Auth using native password verification.
 * 5. Returns generic safe error messages to prevent account enumeration.
 */
export async function signInWithMobileNumber({
  mobileNumber,
  password,
}: SignInWithMobileParams): Promise<SignInWithMobileResult> {
  const validation = validateIndianMobile(mobileNumber);
  if (!validation.isValid) {
    return {
      success: false,
      error: validation.error || "Enter a valid 10-digit mobile number",
    };
  }

  if (!password) {
    return {
      success: false,
      error: "Please enter your password",
    };
  }

  const digits = validation.digits;

  // Check rate limit
  const rateLimit = getRateLimitState(digits);
  if (rateLimit.lockoutUntil && Date.now() < rateLimit.lockoutUntil) {
    const secondsLeft = Math.ceil((rateLimit.lockoutUntil - Date.now()) / 1000);
    return {
      success: false,
      error: `Too many failed attempts. Please wait ${secondsLeft} seconds before trying again.`,
    };
  }

  try {
    // Step 1: Securely resolve the registered email from the 10-digit mobile number
    let resolvedEmail: string | null = null;
    const { data: emailData, error: rpcError } = await (supabase as any).rpc(
      "resolve_auth_email_by_phone",
      { p_phone: digits },
    );

    if (!rpcError && emailData) {
      resolvedEmail = emailData;
    }

    // Step 2: Fallback to get_client_auth_email if resolve_auth_email_by_phone was unavailable
    if (!resolvedEmail) {
      try {
        const { data: legacyEmail } = await (supabase as any).rpc("get_client_auth_email", {
          p_phone: digits,
        });
        if (legacyEmail) resolvedEmail = legacyEmail;
      } catch {
        // Continue
      }
    }

    if (!resolvedEmail) {
      // Record failed attempt and return safe error
      const attempt = recordFailedAttempt(digits);
      if (attempt.locked) {
        return {
          success: false,
          error: `Too many failed attempts. Please wait ${attempt.remainingSeconds} seconds before trying again.`,
        };
      }
      return {
        success: false,
        error: "Invalid mobile number or password.",
      };
    }

    // Step 3: Sign in with Supabase Auth using resolved email and verified password
    const { data, error: signInError } = await supabase.auth.signInWithPassword({
      email: resolvedEmail,
      password,
    });

    if (signInError) {
      const attempt = recordFailedAttempt(digits);
      if (attempt.locked) {
        return {
          success: false,
          error: `Too many failed attempts. Please wait ${attempt.remainingSeconds} seconds before trying again.`,
        };
      }
      return {
        success: false,
        error: "Invalid mobile number or password.",
      };
    }

    // Successful login: reset rate limit
    resetRateLimit(digits);

    return {
      success: true,
      session: data.session,
      user: data.user,
    };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "We couldn't sign you in.",
    };
  }
}

/**
 * Links a 10-digit mobile number to the currently authenticated account.
 */
export async function linkCurrentAccountMobileNumber(
  mobileNumber: string,
): Promise<{ success: boolean; error?: string }> {
  const validation = validateIndianMobile(mobileNumber);
  if (!validation.isValid) {
    return {
      success: false,
      error: validation.error || "Enter a valid 10-digit mobile number",
    };
  }

  try {
    const { data, error } = await (supabase as any).rpc("link_user_mobile_number", {
      p_phone: validation.digits,
    });

    if (error) {
      return { success: false, error: error.message };
    }

    if (data && typeof data === "object" && data.success === false) {
      return { success: false, error: data.error || "Failed to link mobile number." };
    }

    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to link mobile number.",
    };
  }
}

/**
 * Checks whether a 10-digit mobile number is available for registration.
 */
export async function isMobileNumberAvailable(mobileNumber: string): Promise<boolean> {
  const validation = validateIndianMobile(mobileNumber);
  if (!validation.isValid) return false;

  try {
    const { data, error } = await (supabase as any).rpc("check_mobile_number_available", {
      p_phone: validation.digits,
    });
    if (error) return false;
    return !!data;
  } catch {
    return false;
  }
}
