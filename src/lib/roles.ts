export const DEFAULT_TEAM_ROLES = [
  "Photographer",
  "Videographer",
  "Photo Editor",
  "Video Editor",
  "Album Designer",
  "Cinematographer / Creative Director",
  "Drone Operator",
  "Assistant Photographer",
  "Assistant Videographer",
  "Lighting Assistant",
  "Data Manager / Footage Backup Assistant",
];

const STORAGE_KEY = "ta_custom_team_roles";

export function getCustomRoles(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed)
      ? parsed.filter((r): r is string => typeof r === "string" && r.trim().length > 0)
      : [];
  } catch {
    return [];
  }
}

export function saveCustomRole(role: string): {
  success: boolean;
  error?: string;
  roles: string[];
  savedRole?: string;
} {
  if (typeof window === "undefined" || !role) {
    return { success: false, error: "Role cannot be empty", roles: getCustomRoles() };
  }
  const cleaned = role.trim();
  if (!cleaned) {
    return { success: false, error: "Role name cannot be blank", roles: getCustomRoles() };
  }

  // Prevent accidental duplicates (case-insensitive check against both default and existing custom roles)
  const isDefault = DEFAULT_TEAM_ROLES.some((r) => r.toLowerCase() === cleaned.toLowerCase());
  const existing = getCustomRoles();
  const isExistingCustom = existing.some((r) => r.toLowerCase() === cleaned.toLowerCase());

  if (isDefault || isExistingCustom) {
    // Find the exact canonical name
    const existingName =
      DEFAULT_TEAM_ROLES.find((r) => r.toLowerCase() === cleaned.toLowerCase()) ||
      existing.find((r) => r.toLowerCase() === cleaned.toLowerCase()) ||
      cleaned;
    return {
      success: false,
      error: `Role "${existingName}" already exists`,
      roles: existing,
      savedRole: existingName,
    };
  }

  try {
    const updated = [...existing, cleaned];
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    return { success: true, roles: updated, savedRole: cleaned };
  } catch {
    return { success: false, error: "Could not save role to persistent storage", roles: existing };
  }
}

export function getAllRoles(existingMembersRoles: (string | undefined | null)[] = []): string[] {
  const custom = getCustomRoles();
  const memberRoles = existingMembersRoles.filter((r): r is string => Boolean(r && r.trim()));

  const seen = new Set<string>();
  const list: string[] = [];

  // Default roles first
  for (const r of DEFAULT_TEAM_ROLES) {
    const key = r.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      list.push(r);
    }
  }

  // Custom roles next
  for (const r of custom) {
    const key = r.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      list.push(r);
    }
  }

  // Any other active member roles
  for (const r of memberRoles) {
    const key = r.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      list.push(r);
    }
  }

  return list;
}
