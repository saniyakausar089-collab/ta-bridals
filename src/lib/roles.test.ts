import { describe, it, expect, beforeEach } from "vitest";
import { DEFAULT_TEAM_ROLES, getCustomRoles, saveCustomRole, getAllRoles } from "./roles";

describe("Dynamic Role Creation & Persistence", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("should have all predefined default roles available", () => {
    expect(DEFAULT_TEAM_ROLES.length).toBeGreaterThanOrEqual(10);
    expect(DEFAULT_TEAM_ROLES).toContain("Photographer");
    expect(DEFAULT_TEAM_ROLES).toContain("Videographer");
    expect(DEFAULT_TEAM_ROLES).toContain("Drone Operator");
  });

  it("should allow typing and saving a completely new custom role persistently", () => {
    const res = saveCustomRole("Lead Drone Pilot");
    expect(res.success).toBe(true);
    expect(res.savedRole).toBe("Lead Drone Pilot");
    expect(getCustomRoles()).toContain("Lead Drone Pilot");
  });

  it("should prevent duplicate role entries (case-insensitive)", () => {
    // Attempt duplicate of default role
    const duplicateDefault = saveCustomRole("photographer");
    expect(duplicateDefault.success).toBe(false);
    expect(duplicateDefault.error).toContain("already exists");

    // Save custom role
    saveCustomRole("Traditional Videographer");
    // Attempt duplicate of custom role
    const duplicateCustom = saveCustomRole("traditional videographer");
    expect(duplicateCustom.success).toBe(false);
    expect(duplicateCustom.error).toContain("already exists");
  });

  it("should make custom role available in getAllRoles for future dropdowns", () => {
    saveCustomRole("Gimbal Specialist");
    const all = getAllRoles(["Lighting Tech"]);
    expect(all).toContain("Photographer");
    expect(all).toContain("Gimbal Specialist");
    expect(all).toContain("Lighting Tech");
  });
});
