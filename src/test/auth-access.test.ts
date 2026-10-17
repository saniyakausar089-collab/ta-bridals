import { describe, expect, it, vi } from "vitest";
import { checkUserAccess, isOwnerEmail, signUpTeamMember, type ProfileRecord } from "../lib/auth";
import { supabase } from "../integrations/supabase/client";

describe("TA Bridals Auth & Access Control", () => {
  it("recognizes the designated owner email and admin credentials", () => {
    expect(isOwnerEmail("saniyakausar089@gmail.com")).toBe(true);
    expect(isOwnerEmail("SANIYAKAUSAR089@GMAIL.COM")).toBe(true);
    expect(isOwnerEmail("Admin@123")).toBe(true);
    expect(isOwnerEmail("admin@123.com")).toBe(true);
    expect(isOwnerEmail("photographer@example.com")).toBe(false);
    expect(isOwnerEmail(null)).toBe(false);
  });

  it("returns signed-out status when session is null", async () => {
    const access = await checkUserAccess(null);
    expect(access.status).toBe("signed-out");
    expect(access.isAdmin).toBe(false);
    expect(access.isApproved).toBe(false);
  });

  it("validates signup input parameters before calling Supabase", async () => {
    // Missing full name
    const resNoName = await signUpTeamMember({
      fullName: "",
      email: "test@example.com",
      password: "password123",
      confirmPassword: "password123",
    });
    expect(resNoName.success).toBe(false);
    expect(resNoName.error).toMatch(/full name/i);

    // Invalid email
    const resInvalidEmail = await signUpTeamMember({
      fullName: "Maya Sharma",
      email: "invalid-email",
      password: "password123",
      confirmPassword: "password123",
    });
    expect(resInvalidEmail.success).toBe(false);
    expect(resInvalidEmail.error).toMatch(/valid email/i);

    // Password too short
    const resShortPassword = await signUpTeamMember({
      fullName: "Maya Sharma",
      email: "maya@example.com",
      password: "123",
      confirmPassword: "123",
    });
    expect(resShortPassword.success).toBe(false);
    expect(resShortPassword.error).toMatch(/at least 6 characters/i);

    // Password mismatch
    const resMismatch = await signUpTeamMember({
      fullName: "Maya Sharma",
      email: "maya@example.com",
      password: "password123",
      confirmPassword: "different-password",
    });
    expect(resMismatch.success).toBe(false);
    expect(resMismatch.error).toMatch(/do not match/i);
  });

  it("handles duplicate registrations gracefully", async () => {
    const signUpSpy = vi.spyOn(supabase.auth, "signUp").mockResolvedValueOnce({
      data: {
        user: {
          id: "dup-user-id",
          app_metadata: {},
          user_metadata: {},
          aud: "authenticated",
          created_at: new Date().toISOString(),
          identities: [], // Empty identities array indicates already registered user
        },
        session: null,
      },
      error: null,
    });

    const result = await signUpTeamMember({
      fullName: "Existing User",
      email: "existing@example.com",
      password: "password123",
      confirmPassword: "password123",
    });

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/already exists/i);
    signUpSpy.mockRestore();
  });

  it("handles email confirmation requirement on signup", async () => {
    const signUpSpy = vi.spyOn(supabase.auth, "signUp").mockResolvedValueOnce({
      data: {
        user: {
          id: "new-user-id",
          app_metadata: {},
          user_metadata: {},
          aud: "authenticated",
          created_at: new Date().toISOString(),
          identities: [
            {
              id: "identity-1",
              user_id: "new-user-id",
              identity_data: {},
              provider: "email",
              created_at: "",
              updated_at: "",
            },
          ],
        },
        session: null, // session null indicates email confirmation is pending
      },
      error: null,
    });

    const result = await signUpTeamMember({
      fullName: "New Photographer",
      email: "photographer@example.com",
      password: "password123",
      confirmPassword: "password123",
    });

    expect(result.success).toBe(true);
    expect(result.requiresEmailConfirmation).toBe(true);
    expect(result.message).toMatch(/confirm your email/i);
    signUpSpy.mockRestore();
  });
});
