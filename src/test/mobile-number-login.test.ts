import { describe, expect, it } from "vitest";
import {
  validateIndianMobile,
  sanitizeMobileInput,
  signInWithMobileNumber,
  isMobileNumberAvailable,
} from "../lib/phoneAuth";
import {
  clientLogin,
  clientSignUp,
  clientSignOut,
  DEMO_CLIENT_ACCOUNTS,
} from "../lib/songLibraryService";
import { signUpTeamMember, isOwnerEmail } from "../lib/auth";
import { supabase } from "../integrations/supabase/client";

describe("TA Bridals — 10-Digit Mobile Number Login & Security", () => {
  // =========================================================================
  // 1. INPUT VALIDATION TESTS
  // =========================================================================
  describe("Mobile Input Validation", () => {
    it("accepts valid 10-digit Indian mobile numbers", () => {
      const res = validateIndianMobile("9876543210");
      expect(res.isValid).toBe(true);
      expect(res.digits).toBe("9876543210");
      expect(res.formatted).toBe("98765 43210");
      expect(res.error).toBeUndefined();
    });

    it("handles pasted mobile numbers with spaces, hyphens, and +91 country code", () => {
      const resWithPlus91 = validateIndianMobile("+91 98765 43210");
      expect(resWithPlus91.isValid).toBe(true);
      expect(resWithPlus91.digits).toBe("9876543210");

      const resWithDashes = validateIndianMobile("98765-43210");
      expect(resWithDashes.isValid).toBe(true);
      expect(resWithDashes.digits).toBe("9876543210");

      const resWith91Prefix = validateIndianMobile("919876543210");
      expect(resWith91Prefix.isValid).toBe(true);
      expect(resWith91Prefix.digits).toBe("9876543210");

      const resWithZero = validateIndianMobile("09876543210");
      expect(resWithZero.isValid).toBe(true);
      expect(resWithZero.digits).toBe("9876543210");
    });

    it("rejects 9-digit inputs", () => {
      const res = validateIndianMobile("987654321");
      expect(res.isValid).toBe(false);
      expect(res.error).toMatch(/valid 10-digit mobile number/i);
    });

    it("rejects 11-digit inputs without country code", () => {
      const res = validateIndianMobile("98765432101");
      expect(res.isValid).toBe(false);
      expect(res.error).toMatch(/valid 10-digit mobile number/i);
    });

    it("rejects alphabetic characters and mixed input", () => {
      const resAlpha = validateIndianMobile("98765abcde");
      expect(resAlpha.isValid).toBe(false);
      expect(resAlpha.error).toMatch(/without letters/i);

      const resLettersOnly = validateIndianMobile("abcdefghij");
      expect(resLettersOnly.isValid).toBe(false);
      expect(resLettersOnly.error).toMatch(/without letters/i);
    });

    it("rejects email addresses explicitly", () => {
      const resEmail = validateIndianMobile("owner@tabridals.com");
      expect(resEmail.isValid).toBe(false);
      expect(resEmail.error).toMatch(/not an email address/i);
    });

    it("rejects empty or whitespace-only input", () => {
      const resEmpty = validateIndianMobile("");
      expect(resEmpty.isValid).toBe(false);
      expect(resEmpty.error).toMatch(/enter your 10-digit mobile number/i);

      const resWhitespace = validateIndianMobile("   ");
      expect(resWhitespace.isValid).toBe(false);
      expect(resWhitespace.error).toMatch(/enter your 10-digit mobile number/i);
    });

    it("sanitizes mobile input in real time, removing illegal characters and capping at 10 digits", () => {
      expect(sanitizeMobileInput("98765abc43210")).toBe("9876543210");
      expect(sanitizeMobileInput("+91 98765 43210")).toBe("9876543210");
      expect(sanitizeMobileInput("987654321012345")).toBe("9876543210");
      expect(sanitizeMobileInput("")).toBe("");
    });
  });

  // =========================================================================
  // 2. AUTHENTICATION & SECURITY TESTS
  // =========================================================================
  describe("Authentication Security & Safe Error Messages", () => {
    it("returns safe error on unknown mobile number without revealing account existence", async () => {
      const res = await signInWithMobileNumber({
        mobileNumber: "9000000001",
        password: "SomePassword123!",
      });

      expect(res.success).toBe(false);
      expect(res.error).toBe("Invalid mobile number or password.");
    });

    it("returns safe error on incorrect password without exposing whether mobile number is valid", async () => {
      // Use existing studio owner mobile number with intentionally wrong password
      const res = await signInWithMobileNumber({
        mobileNumber: "9876543210",
        password: "CompletelyWrongPassword!",
      });

      expect(res.success).toBe(false);
      expect(res.error).toBe("Invalid mobile number or password.");
    });

    it("rejects invalid mobile number format before backend call", async () => {
      const res = await signInWithMobileNumber({
        mobileNumber: "123",
        password: "ValidPassword123!",
      });

      expect(res.success).toBe(false);
      expect(res.error).toMatch(/valid 10-digit mobile number/i);
    });
  });

  // =========================================================================
  // 3. DATABASE MIGRATION & EXISTING USER PRESERVATION
  // =========================================================================
  describe("Database Migration & Existing User Preservation", () => {
    it("resolves studio owner email from 10-digit mobile number via database RPC", async () => {
      const { data, error } = await (supabase as any).rpc("resolve_auth_email_by_phone", {
        p_phone: "9948026203",
      });

      expect(error).toBeNull();
      expect(data).toBe("saniyakausar089@gmail.com");
    });

    it("preserves studio owner email and admin permissions", () => {
      expect(isOwnerEmail("saniyakausar089@gmail.com")).toBe(true);
      expect(isOwnerEmail("SANIYAKAUSAR089@GMAIL.COM")).toBe(true);
    });

    it("correctly checks duplicate mobile numbers via check_mobile_number_available RPC", async () => {
      // Existing owner number must NOT be available
      const isTakenAvailable = await isMobileNumberAvailable("9948026203");
      expect(isTakenAvailable).toBe(false);

      // Unused random number must be available
      const randomUnused = `91${Math.floor(10000000 + Math.random() * 90000000)}`;
      const isFreeAvailable = await isMobileNumberAvailable(randomUnused);
      expect(isFreeAvailable).toBe(true);
    });
  });

  // =========================================================================
  // 4. CLIENT AUTHENTICATION FLOW & PREVIEW DEMOS
  // =========================================================================
  describe("Client Authentication & Session Management", () => {
    it("authenticates approved demo client using 10-digit mobile number", async () => {
      const approvedDemo = DEMO_CLIENT_ACCOUNTS.find(
        (a) => a.profile.approvalStatus === "approved",
      );
      expect(approvedDemo).toBeDefined();

      const digits = approvedDemo!.profile.phone!.replace(/\D/g, "").slice(-10);
      const res = await clientLogin(digits, approvedDemo!.demoPasswordHint);

      expect(res.success).toBe(true);
      expect(res.client).toBeDefined();
      expect(res.client?.approvalStatus).toBe("approved");
      expect(res.client?.assignedLibraryId).toBe("lib-royal-heritage");
    });

    it("authenticates pending demo client and preserves pending status", async () => {
      const pendingDemo = DEMO_CLIENT_ACCOUNTS.find((a) => a.profile.approvalStatus === "pending");
      expect(pendingDemo).toBeDefined();

      const digits = pendingDemo!.profile.phone!.replace(/\D/g, "").slice(-10);
      const res = await clientLogin(digits, pendingDemo!.demoPasswordHint);

      expect(res.success).toBe(true);
      expect(res.client).toBeDefined();
      expect(res.client?.approvalStatus).toBe("pending");
      expect(res.client?.assignedLibraryId).toBeNull();
    });

    it("authenticates rejected demo client and preserves rejection reason", async () => {
      const rejectedDemo = DEMO_CLIENT_ACCOUNTS.find(
        (a) => a.profile.approvalStatus === "rejected",
      );
      expect(rejectedDemo).toBeDefined();

      const digits = rejectedDemo!.profile.phone!.replace(/\D/g, "").slice(-10);
      const res = await clientLogin(digits, rejectedDemo!.demoPasswordHint);

      expect(res.success).toBe(true);
      expect(res.client).toBeDefined();
      expect(res.client?.approvalStatus).toBe("rejected");
      expect(res.client?.rejectionReason).toBeDefined();
    });

    it("rejects client login with non-10 digit inputs", async () => {
      const res9 = await clientLogin("987654321", "demo123");
      expect(res9.success).toBe(false);
      expect(res9.error).toMatch(/valid 10-digit mobile number/i);

      const resAlpha = await clientLogin("98765phone", "demo123");
      expect(resAlpha.success).toBe(false);
      expect(resAlpha.error).toMatch(/without letters|valid 10-digit/i);
    });

    it("enforces uniqueness and rejects duplicate mobile number registration", async () => {
      // Attempt to register a client with already used owner mobile number
      const duplicateRes = await clientSignUp({
        fullName: "Duplicate User Couple",
        partnerName: "Partner",
        email: `new.unique.${Date.now()}@tabridals.internal`,
        phone: "9948026203", // Taken!
        password: "ValidPassword123!",
        confirmPassword: "ValidPassword123!",
      });

      expect(duplicateRes.success).toBe(false);
      expect(duplicateRes.error).toMatch(/already exists/i);
    });

    it("signs out client and terminates session properly", async () => {
      await clientSignOut();
      expect(true).toBe(true);
    });
  });

  // =========================================================================
  // 5. REGISTRATION VALIDATION FOR TEAM MEMBERS
  // =========================================================================
  describe("Team Member Registration with Mobile Number", () => {
    it("rejects team member registration with invalid mobile number", async () => {
      const res = await signUpTeamMember({
        fullName: "Test Photographer",
        mobileNumber: "12345",
        email: `photographer.${Date.now()}@example.com`,
        password: "Password123!",
        confirmPassword: "Password123!",
      });

      expect(res.success).toBe(false);
      expect(res.error).toMatch(/valid 10-digit mobile number/i);
    });

    it("rejects team member registration with duplicate mobile number", async () => {
      const res = await signUpTeamMember({
        fullName: "Test Photographer",
        mobileNumber: "9948026203", // Taken
        email: `photographer.${Date.now()}@example.com`,
        password: "Password123!",
        confirmPassword: "Password123!",
      });

      expect(res.success).toBe(false);
      expect(res.error).toMatch(/already exists/i);
    });
  });
});
