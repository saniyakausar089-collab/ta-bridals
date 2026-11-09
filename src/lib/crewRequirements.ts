/**
 * TA Bridals - Crew Requirements & Photographer Classification System
 * 
 * CHANGE 2: Add Crew Requirement Counts Before Assignment
 * - Default 0 for all roles (Photographer, Videographer, Drone Operator, Cinematographer, Others)
 * - Admin can edit/increase/decrease counts
 * - Displays total required crew count
 * - Determines assignment slots per role
 * - Shows required vs assigned counts and vacancies
 * 
 * CHANGE 3: Normal / Candidate Selection During Crew Assignment
 * - Photographer assignment slots have a separate classification dropdown (Normal / Candidate)
 * - Defaults to Normal, can be changed to Candidate
 * - Saved with the photographer assignment
 * - Displayed clearly in assigned crew list and retained when reopening
 */

export interface CrewRequirements {
  photographer: number;
  videographer: number;
  drone_operator: number;
  cinematographer: number;
  others: number;
}

export type PhotographerClassification = "Normal" | "Candidate";

export interface RoleCategoryConfig {
  id: keyof CrewRequirements;
  key: keyof CrewRequirements;
  label: string;
  roleMatch: string[];
}

export const ROLE_CATEGORIES: RoleCategoryConfig[] = [
  { id: "photographer", key: "photographer", label: "Photographer", roleMatch: ["photographer", "photo"] },
  { id: "videographer", key: "videographer", label: "Videographer", roleMatch: ["videographer", "video"] },
  { id: "drone_operator", key: "drone_operator", label: "Drone Operator", roleMatch: ["drone", "pilot", "aerial"] },
  { id: "cinematographer", key: "cinematographer", label: "Cinematographer", roleMatch: ["cinematographer", "cinema", "dop"] },
  { id: "others", key: "others", label: "Others", roleMatch: ["editor", "designer", "assistant", "crew", "other"] },
];

export const DEFAULT_CREW_REQUIREMENTS: CrewRequirements = {
  photographer: 0,
  videographer: 0,
  drone_operator: 0,
  cinematographer: 0,
  others: 0,
};

const STORAGE_PREFIX_REQ = "ta_crew_req_";
const STORAGE_PREFIX_CLASS = "ta_photo_class_";

/**
 * Calculates total required crew count across all categories.
 */
export function calculateTotalRequiredCrew(req: CrewRequirements): number {
  return (
    Number(req.photographer || 0) +
    Number(req.videographer || 0) +
    Number(req.drone_operator || 0) +
    Number(req.cinematographer || 0) +
    Number(req.others || 0)
  );
}

/**
 * Retrieves crew requirements for a shoot.
 * Accepts shootId string or shoot object with id and notes.
 * Checks shoot notes first, then localStorage, defaulting to 0 for all categories.
 */
export function getCrewRequirementsForShoot(
  shootOrId: string | { id: string; notes?: string | null },
  maybeNotes?: string | null,
): CrewRequirements {
  const shootId = typeof shootOrId === "string" ? shootOrId : shootOrId?.id;
  const notes = typeof shootOrId === "object" ? shootOrId?.notes : maybeNotes;

  // 1. Check notes for [CrewReq: {...}]
  if (notes) {
    const match = notes.match(/\[CrewReq:\s*(\{.*?\})\]/);
    if (match && match[1]) {
      try {
        const parsed = JSON.parse(match[1]);
        return {
          photographer: Number(parsed.photographer || 0),
          videographer: Number(parsed.videographer || 0),
          drone_operator: Number(parsed.drone_operator || 0),
          cinematographer: Number(parsed.cinematographer || 0),
          others: Number(parsed.others || 0),
        };
      } catch {
        // Fallback to localStorage
      }
    }
  }

  // 2. Check localStorage
  if (typeof window !== "undefined" && shootId) {
    try {
      const raw = localStorage.getItem(`${STORAGE_PREFIX_REQ}${shootId}`);
      if (raw) {
        const parsed = JSON.parse(raw);
        return {
          photographer: Number(parsed.photographer || 0),
          videographer: Number(parsed.videographer || 0),
          drone_operator: Number(parsed.drone_operator || 0),
          cinematographer: Number(parsed.cinematographer || 0),
          others: Number(parsed.others || 0),
        };
      }
    } catch {
      // Ignore
    }
  }

  return { ...DEFAULT_CREW_REQUIREMENTS };
}

/**
 * Retrieves photographer classifications (Normal vs Candidate) for a shoot.
 * Accepts shootId string or shoot object with id and notes.
 * Maps team_member_id -> "Normal" | "Candidate".
 */
export function getPhotographerClassificationsForShoot(
  shootOrId: string | { id: string; notes?: string | null },
  maybeNotes?: string | null,
): Record<string, PhotographerClassification> {
  const shootId = typeof shootOrId === "string" ? shootOrId : shootOrId?.id;
  const notes = typeof shootOrId === "object" ? shootOrId?.notes : maybeNotes;

  // 1. Check notes for [PhotoClass: {...}]
  if (notes) {
    const match = notes.match(/\[PhotoClass:\s*(\{.*?\})\]/);
    if (match && match[1]) {
      try {
        return JSON.parse(match[1]) as Record<string, PhotographerClassification>;
      } catch {
        // Fallback
      }
    }
  }

  // 2. Check localStorage
  if (typeof window !== "undefined" && shootId) {
    try {
      const raw = localStorage.getItem(`${STORAGE_PREFIX_CLASS}${shootId}`);
      if (raw) {
        return JSON.parse(raw) as Record<string, PhotographerClassification>;
      }
    } catch {
      // Ignore
    }
  }

  return {};
}

/**
 * Persists crew requirements locally.
 */
export function saveCrewRequirementsLocally(
  shootId: string,
  requirements: CrewRequirements,
  classifications?: Record<string, PhotographerClassification>,
): void {
  if (typeof window === "undefined" || !shootId) return;
  try {
    localStorage.setItem(`${STORAGE_PREFIX_REQ}${shootId}`, JSON.stringify(requirements));
    if (classifications) {
      localStorage.setItem(`${STORAGE_PREFIX_CLASS}${shootId}`, JSON.stringify(classifications));
    }
  } catch {
    // Ignore storage quota
  }
}

/**
 * Persists photographer classifications locally.
 */
export function savePhotographerClassificationsLocally(
  shootId: string,
  classifications: Record<string, PhotographerClassification>,
): void {
  if (typeof window === "undefined" || !shootId) return;
  try {
    localStorage.setItem(`${STORAGE_PREFIX_CLASS}${shootId}`, JSON.stringify(classifications));
  } catch {
    // Ignore storage quota
  }
}

/**
 * Injects or updates [CrewReq: ...] and [PhotoClass: ...] metadata tags in shoot notes.
 */
export function injectCrewMetaIntoNotes(
  originalNotes: string | null | undefined,
  requirements: CrewRequirements,
  classifications: Record<string, PhotographerClassification>,
): string {
  let notes = (originalNotes || "").trim();

  // Strip existing tags if present
  notes = notes.replace(/\[CrewReq:\s*\{.*?\}\]\s*/g, "");
  notes = notes.replace(/\[PhotoClass:\s*\{.*?\}\]\s*/g, "");

  const reqTag = `[CrewReq: ${JSON.stringify(requirements)}]`;
  const classTag = `[PhotoClass: ${JSON.stringify(classifications)}]`;

  return notes ? `${notes}\n\n${reqTag}\n${classTag}`.trim() : `${reqTag}\n${classTag}`.trim();
}
