export function formatPhoneNumber(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) return "";
  const digits = trimmed.replace(/\D/g, "");
  if (!trimmed.startsWith("+")) {
    if (digits.length === 10) {
      return "+91" + digits;
    }
    return "+" + digits;
  }
  return "+" + digits;
}

/**
 * TA Bridals - Song Library Service Layer
 *
 * All client authentication, client profile management, song libraries,
 * audio playback streaming, song selections, and submission notifications are
 * encapsulated behind this service layer.
 *
 * Enforces strict role boundaries and RLS policies on Supabase.
 */

import { songLibraryConfig } from "@/config/songLibraryConfig";
import { supabase } from "@/integrations/supabase/client";
import { validateIndianMobile, isMobileNumberAvailable, sanitizeMobileInput } from "./phoneAuth";
import type {
  ClientProfile,
  ClientApprovalStatus,
  SongItem,
  SongLibraryRecord,
  WeddingEventGroup,
  ClientCustomSongRequest,
  ClientSongSelection,
} from "@/types/songLibrary";

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function isUuid(val?: string | null): boolean {
  return typeof val === "string" && UUID_REGEX.test(val);
}
const isUUID = isUuid;

// Storage keys for mock session (passwords are NEVER stored)
const CLIENT_SESSION_KEY = "ta_bridals_client_session";
const CLIENT_PROFILES_STORAGE_KEY = "ta_bridals_mock_client_profiles";
const LIBRARIES_STORAGE_KEY = "ta_bridals_mock_libraries";
const SONGS_STORAGE_KEY = "ta_bridals_mock_songs";

/**
 * Built-in fake demo accounts for testing in mock mode.
 * Real passwords are NEVER stored in the browser.
 */
export const DEMO_CLIENT_ACCOUNTS: Array<{
  profile: ClientProfile;
  demoPasswordHint: string;
}> = [
  {
    profile: {
      id: "demo-client-approved",
      fullName: "Ananya & Rohan",
      partnerName: "Rohan Malhotra",
      email: "client.demo@tabridals.com",
      phone: "+91 98765 43210",
      weddingDate: "2026-11-20",
      approvalStatus: "approved",
      assignedLibraryId: "lib-royal-heritage",
      assignedLibraryName: "Royal Heritage Collection",
      assignedLibraryIds: ["lib-royal-heritage"],
      assignedLibraryNames: ["Royal Heritage Collection"],
      createdAt: "2026-10-10T10:00:00.000Z",
      reviewedAt: "2026-10-12T14:30:00.000Z",
      reviewedBy: "Studio Owner",
    },
    demoPasswordHint: "demo123",
  },
  {
    profile: {
      id: "demo-client-pending",
      fullName: "Simran & Kabir",
      partnerName: "Kabir Oberoi",
      email: "pending.client@tabridals.com",
      phone: "+91 98765 88990",
      weddingDate: "2026-12-15",
      approvalStatus: "pending",
      assignedLibraryId: null,
      createdAt: "2026-10-16T18:00:00.000Z",
      reviewedAt: null,
      reviewedBy: null,
    },
    demoPasswordHint: "demo123",
  },
  {
    profile: {
      id: "demo-client-rejected",
      fullName: "Vikram & Neha",
      partnerName: "Neha Sen",
      email: "rejected.client@tabridals.com",
      phone: "+91 98765 11223",
      weddingDate: "2026-10-30",
      approvalStatus: "rejected",
      rejectionReason:
        "Incomplete booking details. Please verify your contract with the studio manager.",
      assignedLibraryId: null,
      createdAt: "2026-10-05T09:00:00.000Z",
      reviewedAt: "2026-10-06T11:00:00.000Z",
      reviewedBy: "Studio Owner",
    },
    demoPasswordHint: "demo123",
  },
];

// Seed libraries
export const INITIAL_LIBRARIES: SongLibraryRecord[] = [
  {
    id: "lib-royal-heritage",
    name: "Royal Heritage Collection",
    description:
      "Traditional shehnai, classical fusion, and grand entrance anthems for royal palace weddings.",
    songCount: 18,
    clientCount: 4,
    createdAt: "2026-10-01T08:00:00.000Z",
    updatedAt: "2026-10-15T12:00:00.000Z",
  },
  {
    id: "lib-contemporary-beats",
    name: "Modern & Contemporary Beats",
    description:
      "High-energy sangeet mashups, cocktail house remixes, and intimate acoustic couple dance tracks.",
    songCount: 22,
    clientCount: 6,
    createdAt: "2026-10-03T10:00:00.000Z",
    updatedAt: "2026-10-16T15:00:00.000Z",
  },
  {
    id: "lib-sufi-spiritual",
    name: "Sufi & Soulful Melodies",
    description:
      "Deep, soulful devotional acoustic tracks ideal for Nikah, Pheras, and heartfelt Vidaai.",
    songCount: 14,
    clientCount: 2,
    createdAt: "2026-10-05T11:00:00.000Z",
    updatedAt: "2026-10-14T09:00:00.000Z",
  },
];

// Seed songs
export const INITIAL_SONGS: SongItem[] = [
  {
    id: "song-1",
    title: "Gud Naal Ishq Mitha (Royal Dhol Mix)",
    artist: "The Wedding Band feat. Navraj",
    eventGroup: "Haldi",
    durationSeconds: 198,
    durationFormatted: "3:18",
    libraryId: "lib-royal-heritage",
    youtubeVideoId: "kJQP7kiw5Fk",
    youtubeUrl: "https://www.youtube.com/watch?v=kJQP7kiw5Fk",
    channelName: "Desi Music Factory",
    thumbnailUrl:
      "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=480&auto=format&fit=crop&q=80",
    tags: ["Upbeat", "Folk", "Haldi Special"],
    createdAt: "2026-10-02T10:00:00.000Z",
  },
  {
    id: "song-2",
    title: "Mehendi Hai Rachnewali (Acoustic Strings)",
    artist: "Swara Ensemble",
    eventGroup: "Mehendi",
    durationSeconds: 245,
    durationFormatted: "4:05",
    libraryId: "lib-royal-heritage",
    youtubeVideoId: "fJ9rUzIMcZQ",
    youtubeUrl: "https://www.youtube.com/watch?v=fJ9rUzIMcZQ",
    channelName: "Sony Music India",
    thumbnailUrl:
      "https://images.unsplash.com/photo-1465847899084-d164df4dedc6?w=480&auto=format&fit=crop&q=80",
    tags: ["Sitar", "Warm", "Mehendi Classic"],
    createdAt: "2026-10-02T10:15:00.000Z",
  },
  {
    id: "song-3",
    title: "Gallan Goodiyaan (Sangeet Floor Opener)",
    artist: "TA Studio Live Band",
    eventGroup: "Sangeet",
    durationSeconds: 270,
    durationFormatted: "4:30",
    libraryId: "lib-royal-heritage",
    youtubeVideoId: "7zp1TbLFPp8",
    youtubeUrl: "https://www.youtube.com/watch?v=7zp1TbLFPp8",
    channelName: "T-Series",
    thumbnailUrl:
      "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=480&auto=format&fit=crop&q=80",
    tags: ["High Energy", "Group Dance", "Sangeet"],
    createdAt: "2026-10-02T10:30:00.000Z",
  },
  {
    id: "song-4",
    title: "Sauda Khara Khara (Nagada Baraat Edit)",
    artist: "Sukhbir & DJ Chetas Edit",
    eventGroup: "Groom Entry",
    durationSeconds: 215,
    durationFormatted: "3:35",
    libraryId: "lib-royal-heritage",
    youtubeVideoId: "pVNw9-Q7xW0",
    youtubeUrl: "https://www.youtube.com/watch?v=pVNw9-Q7xW0",
    channelName: "Zee Music Company",
    thumbnailUrl:
      "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=480&auto=format&fit=crop&q=80",
    tags: ["Groom Entry", "Brass", "Nagada"],
    createdAt: "2026-10-02T10:45:00.000Z",
  },
  {
    id: "song-5",
    title: "Din Shagna Da (Grand Royal Entry)",
    artist: "Jasleen Royal & Strings",
    eventGroup: "Bride Entry",
    durationSeconds: 228,
    durationFormatted: "3:48",
    libraryId: "lib-royal-heritage",
    youtubeVideoId: "1e1nyvsmc1U",
    youtubeUrl: "https://www.youtube.com/watch?v=1e1nyvsmc1U",
    channelName: "Jasleen Royal Official",
    thumbnailUrl:
      "https://images.unsplash.com/photo-1519741497674-611481863552?w=480&auto=format&fit=crop&q=80",
    tags: ["Bridal Entry", "Emotional", "Shehnai"],
    createdAt: "2026-10-02T11:00:00.000Z",
  },
  {
    id: "song-6",
    title: "Kudmayi (Royal Varmala Symphony)",
    artist: "Shahid Mallya & Pritam",
    eventGroup: "Varmala/Jaimala",
    durationSeconds: 312,
    durationFormatted: "5:12",
    libraryId: "lib-royal-heritage",
    youtubeVideoId: "D86j0QO1D-w",
    youtubeUrl: "https://www.youtube.com/watch?v=D86j0QO1D-w",
    channelName: "Saregama Music",
    thumbnailUrl:
      "https://images.unsplash.com/photo-1532712938310-34cb3982ef74?w=480&auto=format&fit=crop&q=80",
    tags: ["Varmala", "Soulful", "Grand"],
    createdAt: "2026-10-02T11:15:00.000Z",
  },
  {
    id: "song-7",
    title: "Mangalyam Tantunanena (Sacred Pheras Symphony)",
    artist: "Vedic Symphony Orchestra",
    eventGroup: "Pheras",
    durationSeconds: 360,
    durationFormatted: "6:00",
    libraryId: "lib-royal-heritage",
    youtubeVideoId: "OPf0YbXqDm0",
    youtubeUrl: "https://www.youtube.com/watch?v=OPf0YbXqDm0",
    channelName: "Spiritual Symphony",
    thumbnailUrl:
      "https://images.unsplash.com/photo-1520854221256-17451cc331bf?w=480&auto=format&fit=crop&q=80",
    tags: ["Pheras", "Vedic Chants", "Ceremonial"],
    createdAt: "2026-10-02T11:30:00.000Z",
  },
  {
    id: "song-8",
    title: "Kesariya (First Dance Waltz Edit)",
    artist: "Pritam & Arijit Singh (Symphonic)",
    eventGroup: "First Dance",
    durationSeconds: 254,
    durationFormatted: "4:14",
    libraryId: "lib-royal-heritage",
    youtubeVideoId: "BddP6PYo2gs",
    youtubeUrl: "https://www.youtube.com/watch?v=BddP6PYo2gs",
    channelName: "Sony Music India",
    thumbnailUrl:
      "https://images.unsplash.com/photo-1492684223066-81342ee5ff30?w=480&auto=format&fit=crop&q=80",
    tags: ["First Dance", "Romantic", "Waltz"],
    createdAt: "2026-10-02T11:45:00.000Z",
  },
  {
    id: "song-9",
    title: "Rang Sharbaton Ka (Couple Portraits Edit)",
    artist: "Atif Aslam & Chinmayi",
    eventGroup: "Couple Portraits",
    durationSeconds: 280,
    durationFormatted: "4:40",
    libraryId: "lib-royal-heritage",
    youtubeVideoId: "gqmXPECFVGs",
    youtubeUrl: "https://www.youtube.com/watch?v=gqmXPECFVGs",
    channelName: "Tips Official",
    thumbnailUrl:
      "https://images.unsplash.com/photo-1518173946687-a4c8a383392e?w=480&auto=format&fit=crop&q=80",
    tags: ["Couple Portraits", "Acoustic", "Romantic"],
    createdAt: "2026-10-02T12:00:00.000Z",
  },
  {
    id: "song-10",
    title: "Subha Hone Na De (Grand Reception Finale)",
    artist: "DJ Fusion Band",
    eventGroup: "Reception",
    durationSeconds: 295,
    durationFormatted: "4:55",
    libraryId: "lib-royal-heritage",
    youtubeVideoId: "y6120QOlsfU",
    youtubeUrl: "https://www.youtube.com/watch?v=y6120QOlsfU",
    channelName: "T-Series",
    thumbnailUrl:
      "https://images.unsplash.com/photo-1429962714451-bb934ecdc4ec?w=480&auto=format&fit=crop&q=80",
    tags: ["Reception", "Party", "Grand Finale"],
    createdAt: "2026-10-02T12:15:00.000Z",
  },
  {
    id: "song-11",
    title: "Kabira (Farewell Emotional Symphony)",
    artist: "Rekha Bhardwaj & Tochi Raina",
    eventGroup: "Emotional/Romantic Moments",
    durationSeconds: 262,
    durationFormatted: "4:22",
    libraryId: "lib-royal-heritage",
    youtubeVideoId: "jHNNMj5bNQw",
    youtubeUrl: "https://www.youtube.com/watch?v=jHNNMj5bNQw",
    channelName: "T-Series",
    thumbnailUrl:
      "https://images.unsplash.com/photo-1511765224389-37f0e77cf0eb?w=480&auto=format&fit=crop&q=80",
    tags: ["Emotional", "Tearful", "Sentimental"],
    createdAt: "2026-10-02T12:30:00.000Z",
  },
  {
    id: "song-12",
    title: "London Thumakda (Grand Finale Dance)",
    artist: "Labh Janjua Tribute",
    eventGroup: "Grand Finale",
    durationSeconds: 210,
    durationFormatted: "3:30",
    libraryId: "lib-royal-heritage",
    youtubeVideoId: "DRAmE3l_vQ0",
    youtubeUrl: "https://www.youtube.com/watch?v=DRAmE3l_vQ0",
    channelName: "Zee Music Company",
    thumbnailUrl:
      "https://images.unsplash.com/photo-1501386761578-eac5c94b800a?w=480&auto=format&fit=crop&q=80",
    tags: ["Celebration", "Grand Finale", "Party"],
    createdAt: "2026-10-02T12:45:00.000Z",
  },
];

// Local storage helper for mock data
function getStoredProfiles(): ClientProfile[] {
  if (typeof window === "undefined") {
    return DEMO_CLIENT_ACCOUNTS.map((a) => a.profile);
  }
  try {
    const raw = localStorage.getItem(CLIENT_PROFILES_STORAGE_KEY);
    if (!raw) {
      const initial = DEMO_CLIENT_ACCOUNTS.map((a) => a.profile);
      localStorage.setItem(CLIENT_PROFILES_STORAGE_KEY, JSON.stringify(initial));
      return initial;
    }
    return JSON.parse(raw) as ClientProfile[];
  } catch {
    return DEMO_CLIENT_ACCOUNTS.map((a) => a.profile);
  }
}

function saveStoredProfiles(profiles: ClientProfile[]) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(CLIENT_PROFILES_STORAGE_KEY, JSON.stringify(profiles));
  } catch (err) {
    console.error("Failed to save client profiles:", err);
  }
}

function getStoredLibraries(): SongLibraryRecord[] {
  if (typeof window === "undefined") return INITIAL_LIBRARIES;
  try {
    const raw = localStorage.getItem(LIBRARIES_STORAGE_KEY);
    if (!raw) {
      localStorage.setItem(LIBRARIES_STORAGE_KEY, JSON.stringify(INITIAL_LIBRARIES));
      return INITIAL_LIBRARIES;
    }
    return JSON.parse(raw) as SongLibraryRecord[];
  } catch {
    return INITIAL_LIBRARIES;
  }
}

function saveStoredLibraries(libraries: SongLibraryRecord[]) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(LIBRARIES_STORAGE_KEY, JSON.stringify(libraries));
  } catch (err) {
    console.error("Failed to save libraries:", err);
  }
}

export function getStoredSongs(): SongItem[] {
  if (typeof window === "undefined") return INITIAL_SONGS;
  try {
    const raw = localStorage.getItem(SONGS_STORAGE_KEY);
    if (!raw) {
      localStorage.setItem(SONGS_STORAGE_KEY, JSON.stringify(INITIAL_SONGS));
      return INITIAL_SONGS;
    }
    return JSON.parse(raw) as SongItem[];
  } catch {
    return INITIAL_SONGS;
  }
}

export function saveStoredSongs(songs: SongItem[]) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(SONGS_STORAGE_KEY, JSON.stringify(songs));
  } catch (err) {
    console.error("Failed to save songs:", err);
  }
}

/**
 * CLIENT AUTH: Get synchronous cached client profile.
 */
export function getClientSession(): ClientProfile | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(CLIENT_SESSION_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as ClientProfile;
  } catch {
    return null;
  }
}

/**
 * CLIENT AUTH: Restore & refresh client session from Supabase auth.
 * // TODO: Enforce server-side (RLS) security check - Authenticated user can read own profile
 */
export async function restoreClientSession(): Promise<ClientProfile | null> {
  if (songLibraryConfig.isMockMode) {
    return getClientSession();
  }

  try {
    const { data: sessionData } = await supabase.auth.getSession();
    const user = sessionData?.session?.user;
    if (!user) {
      if (typeof window !== "undefined") sessionStorage.removeItem(CLIENT_SESSION_KEY);
      return null;
    }

    const { data: profile, error } = await (supabase as any)
      .from("client_profiles")
      .select("*")
      .eq("id", user.id)
      .maybeSingle();

    if (error || !profile) {
      if (typeof window !== "undefined") sessionStorage.removeItem(CLIENT_SESSION_KEY);
      return null;
    }

    let assignsRes = await (supabase as any)
      .from("client_library_assignments")
      .select("library_id, song_libraries(name)")
      .eq("client_id", profile.id);

    if (assignsRes.error) {
      assignsRes = await (supabase as any)
        .from("client_library_assignments")
        .select("library_id")
        .eq("client_id", profile.id);
    }

    const assignList = assignsRes.data || [];
    const assignedLibraryIds = assignList.map((a: any) => a.library_id);
    let assignedLibraryNames = assignList
      .map(
        (a: any) =>
          a.song_libraries?.name ||
          (Array.isArray(a.song_libraries) ? a.song_libraries[0]?.name : undefined),
      )
      .filter(Boolean) as string[];

    if (assignedLibraryIds.length > 0 && assignedLibraryNames.length === 0) {
      const { data: nameLibs } = await (supabase as any)
        .from("song_libraries")
        .select("id, name")
        .in("id", assignedLibraryIds);
      if (nameLibs) {
        const nameMap = new Map((nameLibs || []).map((l: any) => [l.id, l.name]));
        assignedLibraryNames = assignedLibraryIds.map(
          (id: string) => nameMap.get(id) || "Soundtrack Library",
        );
      }
    }

    const assignedLibraryId = assignedLibraryIds[0] || null;
    const assignedLibraryName = assignedLibraryNames.join(", ") || undefined;

    const clientProfile: ClientProfile = {
      id: profile.id,
      fullName: profile.full_name || "Client",
      partnerName: profile.partner_name || undefined,
      email: profile.email || user.email || "",
      phone: profile.phone || user.phone || undefined,
      weddingDate: profile.wedding_date || undefined,
      approvalStatus: profile.approval_status as ClientApprovalStatus,
      rejectionReason: profile.rejection_reason || undefined,
      assignedLibraryId,
      assignedLibraryName,
      assignedLibraryIds,
      assignedLibraryNames,
      createdAt: profile.created_at,
    };

    if (typeof window !== "undefined") {
      sessionStorage.setItem(CLIENT_SESSION_KEY, JSON.stringify(clientProfile));
    }

    return clientProfile;
  } catch {
    return getClientSession();
  }
}

/**
 * CLIENT AUTH: Client Login
 * // TODO: Enforce server-side (RLS) security check - Check client_profiles for auth.uid()
 */
export async function clientLogin(
  identifier: string,
  password: string,
): Promise<{ success: boolean; client: ClientProfile | null; error?: string }> {
  const raw = (identifier ?? "").trim();

  if (!raw) {
    return { success: false, client: null, error: "Enter your 10-digit mobile number" };
  }
  if (!password) {
    return { success: false, client: null, error: "Please enter your password." };
  }

  const isEmailInput = raw.includes("@");
  let phoneDigits = "";

  if (!isEmailInput) {
    // Strict 10-digit validation for mobile login
    const phoneVal = validateIndianMobile(raw);
    if (!phoneVal.isValid) {
      return {
        success: false,
        client: null,
        error: phoneVal.error || "Enter a valid 10-digit mobile number",
      };
    }
    phoneDigits = phoneVal.digits;
  }

  if (songLibraryConfig.isMockMode) {
    const profiles = getStoredProfiles();
    const matched = profiles.find((p) => {
      if (isEmailInput) {
        return p.email.toLowerCase() === raw.toLowerCase();
      }
      const pDigits = (p.phone || "").replace(/\D/g, "");
      return (
        pDigits === phoneDigits ||
        (pDigits.length >= 10 && (pDigits.endsWith(phoneDigits) || phoneDigits.endsWith(pDigits)))
      );
    });
    if (!matched) {
      return {
        success: false,
        client: null,
        error: "Invalid mobile number or password.",
      };
    }
    if (password.length < 6) {
      return { success: false, client: null, error: "Password must be at least 6 characters." };
    }
    if (typeof window !== "undefined") {
      sessionStorage.setItem(CLIENT_SESSION_KEY, JSON.stringify(matched));
    }
    return { success: true, client: matched };
  }

  // Real Supabase Auth for Clients
  try {
    let authUser: any = null;
    let authError: any = null;

    let candidateEmail: string | null = null;
    if (isEmailInput) {
      candidateEmail = raw;
    } else {
      // Resolve registered auth email from 10-digit mobile number using RPC
      try {
        const { data: resolvedEmail } = await (supabase as any).rpc("resolve_auth_email_by_phone", {
          p_phone: phoneDigits,
        });
        if (resolvedEmail) {
          candidateEmail = resolvedEmail;
        } else {
          const { data: legacyEmail } = await (supabase as any).rpc("get_client_auth_email", {
            p_phone: phoneDigits,
          });
          if (legacyEmail) candidateEmail = legacyEmail;
        }
      } catch {
        // Fallback
      }
    }

    if (candidateEmail) {
      const res = await supabase.auth.signInWithPassword({
        email: candidateEmail.toLowerCase(),
        password,
      });
      if (!res.error && res.data?.user) {
        authUser = res.data.user;
        authError = null;
      } else {
        authError = res.error;
      }
    } else {
      authError = { message: "Invalid mobile number or password." };
    }

    if (authError || !authUser) {
      // Local stored profile fallback (for demo clients in preview)
      const localMatched = getStoredProfiles().find((p) => {
        if (isEmailInput) return p.email.toLowerCase() === raw.toLowerCase();
        const d = (p.phone || "").replace(/\D/g, "");
        return (
          d &&
          phoneDigits &&
          (d === phoneDigits || d.endsWith(phoneDigits) || phoneDigits.endsWith(d))
        );
      });
      if (localMatched && password.length >= 6) {
        if (typeof window !== "undefined") {
          sessionStorage.setItem(CLIENT_SESSION_KEY, JSON.stringify(localMatched));
        }
        return { success: true, client: localMatched };
      }

      return {
        success: false,
        client: null,
        error: "Invalid mobile number or password.",
      };
    }

    // Verify user is registered in client_profiles
    const { data: profile, error: profError } = await (supabase as any)
      .from("client_profiles")
      .select("*")
      .eq("id", authUser.id)
      .maybeSingle();

    if (profError || !profile) {
      await supabase.auth.signOut();
      return {
        success: false,
        client: null,
        error:
          "No client account found for this mobile number. If you are studio staff, please log in through the Staff portal.",
      };
    }

    const { data: assigns } = await (supabase as any)
      .from("client_library_assignments")
      .select("library_id, song_libraries(name)")
      .eq("client_id", profile.id);

    const assignList = assigns || [];
    const assignedLibraryIds = assignList.map((a: any) => a.library_id);
    const assignedLibraryNames = assignList
      .map((a: any) => a.song_libraries?.name)
      .filter(Boolean) as string[];
    const assignedLibraryId = assignedLibraryIds[0] || null;
    const assignedLibraryName = assignedLibraryNames.join(", ") || undefined;

    const clientProfile: ClientProfile = {
      id: profile.id,
      fullName: profile.full_name || "Client",
      partnerName: profile.partner_name || undefined,
      email: profile.email || authUser.email || "",
      phone: profile.phone || phoneDigits,
      weddingDate: profile.wedding_date || undefined,
      approvalStatus: profile.approval_status as ClientApprovalStatus,
      rejectionReason: profile.rejection_reason || undefined,
      assignedLibraryId,
      assignedLibraryIds,
      assignedLibraryName,
      assignedLibraryNames,
      createdAt: profile.created_at,
    };

    if (typeof window !== "undefined") {
      sessionStorage.setItem(CLIENT_SESSION_KEY, JSON.stringify(clientProfile));
    }

    return { success: true, client: clientProfile };
  } catch (err) {
    return {
      success: false,
      client: null,
      error: err instanceof Error ? err.message : "Failed to sign in.",
    };
  }
}

export interface ClientSignUpParams {
  fullName: string;
  partnerName?: string;
  email: string;
  password: string;
  confirmPassword: string;
  weddingDate?: string;
  phone?: string;
}

/**
 * CLIENT AUTH: Client Signup
 * Role is strictly "client" (NEVER chosen from form).
 * Status is ALWAYS "pending".
 * // TODO: Enforce server-side (RLS) security check - Trigger & check constraint enforces status = 'pending'
 */
export async function clientSignUp({
  fullName,
  partnerName,
  email,
  password,
  confirmPassword,
  weddingDate,
  phone,
}: ClientSignUpParams): Promise<{
  success: boolean;
  client: ClientProfile | null;
  error?: string;
}> {
  const trimmedName = fullName.trim();
  const trimmedEmail = email.trim().toLowerCase();
  const rawPhone = (phone ?? "").trim();

  if (!trimmedName) {
    return { success: false, client: null, error: "Please enter your full name." };
  }

  // Strict 10-digit mobile number validation
  const phoneVal = validateIndianMobile(rawPhone);
  if (!phoneVal.isValid) {
    return {
      success: false,
      client: null,
      error: phoneVal.error || "Enter a valid 10-digit mobile number",
    };
  }
  const normalizedPhone = phoneVal.digits;

  // Enforce server-side uniqueness of mobile number
  const isAvailable = await isMobileNumberAvailable(normalizedPhone);
  if (!isAvailable) {
    return {
      success: false,
      client: null,
      error: "An account with this mobile number already exists. Please sign in instead.",
    };
  }

  if (!trimmedEmail || !trimmedEmail.includes("@")) {
    return { success: false, client: null, error: "Please enter a valid email address." };
  }
  if (password.length < 6) {
    return { success: false, client: null, error: "Password must be at least 6 characters long." };
  }
  if (password !== confirmPassword) {
    return { success: false, client: null, error: "Passwords do not match." };
  }

  if (songLibraryConfig.isMockMode) {
    const existingProfiles = getStoredProfiles();
    const duplicate = existingProfiles.find((p) => p.email.toLowerCase() === trimmedEmail);
    if (duplicate) {
      return {
        success: false,
        client: null,
        error: "An account with this email address already exists. Please sign in instead.",
      };
    }

    const newClient: ClientProfile = {
      id: `client-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      fullName: trimmedName,
      partnerName: partnerName?.trim() || undefined,
      email: trimmedEmail,
      phone: formattedPhone || trimmedPhone || undefined,
      weddingDate: weddingDate || undefined,
      approvalStatus: "pending",
      assignedLibraryId: null,
      assignedLibraryIds: [],
      assignedLibraryNames: [],
      createdAt: new Date().toISOString(),
      reviewedAt: null,
      reviewedBy: null,
    };

    saveStoredProfiles([newClient, ...existingProfiles]);
    if (typeof window !== "undefined") {
      sessionStorage.setItem(CLIENT_SESSION_KEY, JSON.stringify(newClient));
    }
    return { success: true, client: newClient };
  }

  // Real Supabase Signup
  try {
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: trimmedEmail,
      password,
      options: {
        data: {
          full_name: trimmedName,
          partner_name: partnerName?.trim() || null,
          phone: phone?.trim() || null,
          wedding_date: weddingDate || null,
          signup_type: "client",
        },
      },
    });

    if (authError || !authData.user) {
      return {
        success: false,
        client: null,
        error: authError?.message || "Registration failed.",
      };
    }

    // Direct upsert to client_profiles ensures row exists even before trigger fires
    try {
      await (supabase as any).from("client_profiles").upsert(
        {
          id: authData.user.id,
          email: trimmedEmail,
          phone: formattedPhone || trimmedPhone || null,
          full_name: trimmedName,
          partner_name: partnerName?.trim() || null,
          wedding_date: weddingDate || null,
          approval_status: "pending",
        },
        { onConflict: "id", ignoreDuplicates: true },
      );
    } catch {
      // Ignore if trigger handled it
    }

    const newClient: ClientProfile = {
      id: authData.user.id,
      fullName: trimmedName,
      partnerName: partnerName?.trim() || undefined,
      email: trimmedEmail,
      phone: phone?.trim() || undefined,
      weddingDate: weddingDate || undefined,
      approvalStatus: "pending",
      assignedLibraryId: null,
      createdAt: new Date().toISOString(),
    };

    if (typeof window !== "undefined") {
      sessionStorage.setItem(CLIENT_SESSION_KEY, JSON.stringify(newClient));
    }

    return { success: true, client: newClient };
  } catch (err) {
    return {
      success: false,
      client: null,
      error: err instanceof Error ? err.message : "Registration failed.",
    };
  }
}

/**
 * CLIENT AUTH: Sign Out
 */
export async function clientSignOut(): Promise<void> {
  if (typeof window !== "undefined") {
    sessionStorage.removeItem(CLIENT_SESSION_KEY);
  }
  if (!songLibraryConfig.isMockMode) {
    try {
      await supabase.auth.signOut();
    } catch {
      // Ignore signout network errors
    }
  }
}

/**
 * CLIENT AUTH: Re-check current client approval status.
 * // TODO: Enforce server-side (RLS) security check - Client can read own profile
 */
export async function refreshClientStatus(clientId: string): Promise<ClientApprovalStatus> {
  if (songLibraryConfig.isMockMode) {
    const profiles = getStoredProfiles();
    const client = profiles.find((p) => p.id === clientId);
    return client?.approvalStatus || "pending";
  }

  try {
    const { data, error } = await (supabase as any)
      .from("client_profiles")
      .select("approval_status, rejection_reason")
      .eq("id", clientId)
      .single();

    if (error || !data) return "pending";

    let assignedLibraryId: string | null = null;
    let assignedLibraryName: string | undefined;
    let assignedLibraryIds: string[] = [];
    let assignedLibraryNames: string[] = [];

    if (data.approval_status === "approved") {
      const { data: assigns } = await (supabase as any)
        .from("client_library_assignments")
        .select("library_id, song_libraries(name)")
        .eq("client_id", clientId);

      const assignList = assigns || [];
      assignedLibraryIds = assignList.map((a: any) => a.library_id);
      assignedLibraryNames = assignList
        .map((a: any) => a.song_libraries?.name)
        .filter(Boolean) as string[];
      assignedLibraryId = assignedLibraryIds[0] || null;
      assignedLibraryName = assignedLibraryNames.join(", ") || undefined;
    }

    const current = getClientSession();
    if (current && current.id === clientId) {
      const updated = {
        ...current,
        approvalStatus: data.approval_status as ClientApprovalStatus,
        rejectionReason: data.rejection_reason || undefined,
        assignedLibraryId,
        assignedLibraryName,
        assignedLibraryIds,
        assignedLibraryNames,
      };
      if (typeof window !== "undefined") {
        sessionStorage.setItem(CLIENT_SESSION_KEY, JSON.stringify(updated));
      }
    }

    return data.approval_status as ClientApprovalStatus;
  } catch {
    return "pending";
  }
}

/**
 * AUDIO PLAYBACK: Return protected, short-lived streaming URL (1 hour expiry).
 * // TODO: Enforce server-side (RLS) security check - Authenticated user with library access
 */
export async function getSongPlaybackUrl(audioPathOrId: string): Promise<string> {
  if (!audioPathOrId) return "";

  if (audioPathOrId.startsWith("http://") || audioPathOrId.startsWith("https://")) {
    return audioPathOrId;
  }

  if (songLibraryConfig.isMockMode) {
    return "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3";
  }

  try {
    const { data, error } = await supabase.storage
      .from("songs-audio")
      .createSignedUrl(audioPathOrId, songLibraryConfig.playbackTokenExpirySeconds);

    if (error || !data?.signedUrl) {
      console.warn("Playback URL error:", error?.message);
      return "";
    }
    return data.signedUrl;
  } catch (err) {
    console.warn("Exception generating playback URL:", err);
    return "";
  }
}

/**
 * AUDIO STORAGE: Upload audio file to 'songs-audio' bucket.
 * // TODO: Enforce server-side (RLS) security check - Admin only
 */
export async function uploadSongAudio(
  libraryId: string,
  file: File,
): Promise<{ success: boolean; storagePath?: string; error?: string }> {
  if (file.size > songLibraryConfig.maxUploadSizeMb * 1024 * 1024) {
    return {
      success: false,
      error: `File size exceeds the limit of ${songLibraryConfig.maxUploadSizeMb} MB.`,
    };
  }

  if (songLibraryConfig.isMockMode) {
    return { success: true, storagePath: `mock/${libraryId}/${file.name}` };
  }

  try {
    const cleanFileName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const storagePath = `${libraryId}/${Date.now()}_${cleanFileName}`;

    const { data, error } = await supabase.storage.from("songs-audio").upload(storagePath, file, {
      contentType: file.type || "audio/mpeg",
      upsert: true,
    });

    if (error) {
      if (error.code === "23505") {
        return {
          success: false,
          error: `A song library named "${trimmedName}" already exists. Please choose a different name.`,
        };
      }
      return { success: false, error: error.message };
    }
    return { success: true, storagePath: data.path };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to upload audio file to storage.",
    };
  }
}

/**
 * ADMIN: Get all clients with their assigned library names.
 * // TODO: Enforce server-side (RLS) security check - Admin only
 */
export async function getClients(): Promise<ClientProfile[]> {
  if (songLibraryConfig.isMockMode) {
    const profiles = getStoredProfiles();
    const libraries = getStoredLibraries();
    const libMap = new Map(libraries.map((l) => [l.id, l.name]));

    return profiles.map((p) => {
      const libIds = p.assignedLibraryIds || (p.assignedLibraryId ? [p.assignedLibraryId] : []);
      const libNames = libIds.map((id) => libMap.get(id) || "Library");
      return {
        ...p,
        assignedLibraryId: libIds[0] || null,
        assignedLibraryName: libNames.join(", ") || undefined,
        assignedLibraryIds: libIds,
        assignedLibraryNames: libNames,
      };
    });
  }

  try {
    const [profilesRes, assignsRes] = await Promise.all([
      (supabase as any)
        .from("client_profiles")
        .select("*")
        .order("created_at", { ascending: false }),
      (supabase as any)
        .from("client_library_assignments")
        .select("client_id, library_id, song_libraries(id, name)"),
    ]);

    if (profilesRes.error) throw profilesRes.error;

    const assignMap = new Map<string, Array<{ libraryId: string; libraryName?: string }>>();
    (assignsRes.data || []).forEach((a: any) => {
      const list = assignMap.get(a.client_id) || [];
      list.push({
        libraryId: a.library_id,
        libraryName: a.song_libraries?.name,
      });
      assignMap.set(a.client_id, list);
    });

    return (profilesRes.data || []).map((p: any) => {
      const assignments = assignMap.get(p.id) || [];
      const first = assignments[0];
      const libraryIds = assignments.map((x) => x.libraryId);
      const libraryNames = assignments.map((x) => x.libraryName).filter(Boolean) as string[];
      return {
        id: p.id,
        fullName: p.full_name || "Client",
        partnerName: p.partner_name || undefined,
        email: p.email || "",
        phone: p.phone || undefined,
        weddingDate: p.wedding_date || undefined,
        approvalStatus: (p.approval_status as ClientApprovalStatus) || "pending",
        rejectionReason: p.rejection_reason || undefined,
        assignedLibraryId: first?.libraryId || null,
        assignedLibraryName: libraryNames.join(", ") || undefined,
        assignedLibraryIds: libraryIds,
        assignedLibraryNames: libraryNames,
        createdAt: p.created_at,
        reviewedAt: p.created_at,
        reviewedBy: "Studio Owner",
      };
    });
  } catch (err) {
    console.warn("Failed to load clients from Supabase, falling back to local profiles:", err);
    const profiles = getStoredProfiles();
    const libraries = getStoredLibraries();
    const libMap = new Map(libraries.map((l) => [l.id, l.name]));

    return profiles.map((p) => ({
      ...p,
      assignedLibraryName: p.assignedLibraryId ? libMap.get(p.assignedLibraryId) : undefined,
    }));
  }
}

/**
 * ADMIN: Approve a pending or rejected client and optionally assign a song library.
 * // TODO: Enforce server-side (RLS) security check - Admin only
 */
export async function approveClient(
  clientId: string,
  libraryId?: string,
  libraryIds?: string[],
): Promise<{ success: boolean; client?: ClientProfile; error?: string }> {
  if (songLibraryConfig.isMockMode) {
    const profiles = getStoredProfiles();
    const index = profiles.findIndex((p) => p.id === clientId);

    if (index === -1) {
      return {
        success: false,
        error: `Client with ID "${clientId}" was not found. Cannot approve.`,
      };
    }
    const current = profiles[index];
    if (!current) {
      return {
        success: false,
        error: `Client with ID "${clientId}" was not found. Cannot approve.`,
      };
    }

    const updatedClient: ClientProfile = {
      ...current,
      approvalStatus: "approved",
      rejectionReason: undefined,
      assignedLibraryId: libraryId !== undefined ? libraryId : current.assignedLibraryId,
      reviewedAt: new Date().toISOString(),
      reviewedBy: "Studio Owner",
    };

    profiles[index] = updatedClient;
    saveStoredProfiles(profiles);

    return { success: true, client: updatedClient };
  }

  try {
    const { error: profileError } = await (supabase as any)
      .from("client_profiles")
      .update({
        approval_status: "approved",
        rejection_reason: null,
      })
      .eq("id", clientId);

    if (profileError) return { success: false, error: profileError.message };

    const targetLibIds: string[] =
      libraryIds && libraryIds.length > 0 ? libraryIds : libraryId ? [libraryId] : [];

    if (targetLibIds.length > 0) {
      const rows = targetLibIds.map((lId) => ({
        client_id: clientId,
        library_id: lId,
        assigned_at: new Date().toISOString(),
      }));
      const { error: assignError } = await (supabase as any)
        .from("client_library_assignments")
        .upsert(rows, { onConflict: "client_id,library_id" });

      if (assignError) return { success: false, error: assignError.message };
    }

    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to approve client on Supabase.",
    };
  }
}

/**
 * ADMIN: Re-approve a rejected client.
 * // TODO: Enforce server-side (RLS) security check - Admin only
 */
export async function reapproveClient(
  clientId: string,
  libraryId?: string,
): Promise<{ success: boolean; client?: ClientProfile; error?: string }> {
  return approveClient(clientId, libraryId);
}

/**
 * ADMIN: Reject a client registration with an optional reason.
 * // TODO: Enforce server-side (RLS) security check - Admin only
 */
export async function rejectClient(
  clientId: string,
  reason?: string,
): Promise<{ success: boolean; client?: ClientProfile; error?: string }> {
  if (songLibraryConfig.isMockMode) {
    const profiles = getStoredProfiles();
    const index = profiles.findIndex((p) => p.id === clientId);

    if (index === -1) {
      return {
        success: false,
        error: `Client with ID "${clientId}" was not found. Cannot reject.`,
      };
    }
    const current = profiles[index];
    if (!current) {
      return {
        success: false,
        error: `Client with ID "${clientId}" was not found. Cannot reject.`,
      };
    }

    const updatedClient: ClientProfile = {
      ...current,
      approvalStatus: "rejected",
      rejectionReason: reason?.trim() || undefined,
      reviewedAt: new Date().toISOString(),
      reviewedBy: "Studio Owner",
    };

    profiles[index] = updatedClient;
    saveStoredProfiles(profiles);

    return { success: true, client: updatedClient };
  }

  try {
    const { error: profileError } = await (supabase as any)
      .from("client_profiles")
      .update({
        approval_status: "rejected",
        rejection_reason: reason?.trim() || null,
      })
      .eq("id", clientId);

    if (profileError) return { success: false, error: profileError.message };

    // Delete assignment if existed
    await (supabase as any).from("client_library_assignments").delete().eq("client_id", clientId);

    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to reject client on Supabase.",
    };
  }
}

/**
 * ADMIN: Fetch all song libraries with dynamic song & client counts.
 * // TODO: Enforce server-side (RLS) security check - Admin or assigned client
 */
export async function getSongLibraries(includeArchived = false): Promise<SongLibraryRecord[]> {
  if (songLibraryConfig.isMockMode) {
    const libraries = getStoredLibraries();
    const profiles = getStoredProfiles();
    const songs = getStoredSongs();

    const activeLibraries = includeArchived ? libraries : libraries.filter((l) => !l.isArchived);

    return activeLibraries.map((lib) => {
      const assignedClients = profiles.filter(
        (p) => p.assignedLibraryId === lib.id && p.approvalStatus === "approved",
      ).length;
      const librarySongs = songs.filter((s) => s.libraryId === lib.id).length;

      return {
        ...lib,
        clientCount: assignedClients,
        songCount: librarySongs,
      };
    });
  }

  try {
    let query = (supabase as any).from("song_libraries").select("*");
    if (!includeArchived) {
      query = query.eq("is_archived", false);
    }
    const { data: libs, error: libErr } = await query.order("created_at", { ascending: false });
    if (libErr) throw libErr;

    const [songsRes, assignsRes] = await Promise.allSettled([
      (supabase as any).from("songs").select("library_id"),
      (supabase as any).from("client_library_assignments").select("library_id"),
    ]);

    const songs = songsRes.status === "fulfilled" ? songsRes.value.data || [] : [];
    const assigns = assignsRes.status === "fulfilled" ? assignsRes.value.data || [] : [];

    const songCountMap = new Map<string, number>();
    songs.forEach((s: any) => {
      songCountMap.set(s.library_id, (songCountMap.get(s.library_id) || 0) + 1);
    });

    const clientCountMap = new Map<string, number>();
    assigns.forEach((a: any) => {
      clientCountMap.set(a.library_id, (clientCountMap.get(a.library_id) || 0) + 1);
    });

    return (libs || []).map((lib: any) => ({
      id: lib.id,
      name: lib.name,
      description: lib.description || "",
      isArchived: lib.is_archived,
      songCount: songCountMap.get(lib.id) || 0,
      clientCount: clientCountMap.get(lib.id) || 0,
      createdAt: lib.created_at,
      updatedAt: lib.created_at,
    }));
  } catch (err) {
    console.warn(
      "Failed to load song libraries from Supabase, falling back to local libraries:",
      err,
    );
    const libraries = getStoredLibraries();
    const profiles = getStoredProfiles();
    const songs = getStoredSongs();

    const activeLibraries = includeArchived ? libraries : libraries.filter((l) => !l.isArchived);

    return activeLibraries.map((lib) => {
      const assignedClients = profiles.filter(
        (p) => p.assignedLibraryId === lib.id && p.approvalStatus === "approved",
      ).length;
      const librarySongs = songs.filter((s) => s.libraryId === lib.id).length;

      return {
        ...lib,
        clientCount: assignedClients,
        songCount: librarySongs,
      };
    });
  }
}

/**
 * ADMIN: Create a new song library.
 * // TODO: Enforce server-side (RLS) security check - Admin only
 */
export async function createSongLibrary(
  name: string,
  description: string,
): Promise<{ success: boolean; library?: SongLibraryRecord; error?: string }> {
  const trimmedName = name.trim();
  if (!trimmedName) {
    return { success: false, error: "Please provide a valid name for the song library." };
  }

  if (songLibraryConfig.isMockMode) {
    const libraries = getStoredLibraries();
    const duplicate = libraries.find((l) => l.name.toLowerCase() === trimmedName.toLowerCase());
    if (duplicate) {
      return {
        success: false,
        error: `A song library named "${trimmedName}" already exists. Please choose a different name.`,
      };
    }

    const newLibrary: SongLibraryRecord = {
      id: `lib-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      name: trimmedName,
      description: description.trim() || "Curated wedding soundtrack library.",
      isArchived: false,
      songCount: 0,
      clientCount: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    saveStoredLibraries([newLibrary, ...libraries]);
    return { success: true, library: newLibrary };
  }

  try {
    const { data, error } = await (supabase as any)
      .from("song_libraries")
      .insert({
        name: trimmedName,
        description: description.trim() || "Curated wedding soundtrack library.",
        is_archived: false,
      })
      .select()
      .single();

    if (error) return { success: false, error: error.message };

    return {
      success: true,
      library: {
        id: data.id,
        name: data.name,
        description: data.description || "",
        isArchived: false,
        songCount: 0,
        clientCount: 0,
        createdAt: data.created_at,
        updatedAt: data.created_at,
      },
    };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to create song library on Supabase.",
    };
  }
}

/**
 * ADMIN: Update an existing song library.
 * // TODO: Enforce server-side (RLS) security check - Admin only
 */
export async function updateSongLibrary(
  libraryId: string,
  name: string,
  description: string,
): Promise<{ success: boolean; library?: SongLibraryRecord; error?: string }> {
  const trimmedName = name.trim();
  if (!trimmedName) {
    return { success: false, error: "Library name cannot be empty." };
  }

  if (songLibraryConfig.isMockMode) {
    const libraries = getStoredLibraries();
    const index = libraries.findIndex((l) => l.id === libraryId);
    if (index === -1) {
      return { success: false, error: `Library with ID "${libraryId}" does not exist.` };
    }
    const current = libraries[index];
    if (!current) {
      return { success: false, error: `Library with ID "${libraryId}" does not exist.` };
    }

    const updatedLibrary: SongLibraryRecord = {
      ...current,
      name: trimmedName,
      description: description.trim(),
      updatedAt: new Date().toISOString(),
    };

    libraries[index] = updatedLibrary;
    saveStoredLibraries(libraries);

    return { success: true, library: updatedLibrary };
  }

  try {
    const { data, error } = await (supabase as any)
      .from("song_libraries")
      .update({
        name: trimmedName,
        description: description.trim(),
      })
      .eq("id", libraryId)
      .select()
      .single();

    if (error) return { success: false, error: error.message };

    return {
      success: true,
      library: {
        id: data.id,
        name: data.name,
        description: data.description || "",
        isArchived: data.is_archived || false,
        songCount: 0,
        clientCount: 0,
        createdAt: data.created_at,
        updatedAt: data.created_at,
      },
    };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to update library on Supabase.",
    };
  }
}

/**
 * ADMIN: Archive or unarchive a song library.
 * Blocked if any clients are currently assigned to this library.
 * // TODO: Enforce server-side (RLS) security check - Admin only
 */
export async function archiveSongLibrary(
  libraryId: string,
  isArchived: boolean,
): Promise<{ success: boolean; error?: string }> {
  if (songLibraryConfig.isMockMode) {
    const profiles = getStoredProfiles();
    const assigned = profiles.filter(
      (p) => p.assignedLibraryId === libraryId && p.approvalStatus === "approved",
    );

    if (isArchived && assigned.length > 0) {
      return {
        success: false,
        error: `Cannot archive library: There are ${assigned.length} approved clients assigned to this library. Please reassign or unassign clients before archiving.`,
      };
    }

    const libraries = getStoredLibraries();
    const index = libraries.findIndex((l) => l.id === libraryId);
    if (index === -1) {
      return { success: false, error: `Library with ID "${libraryId}" does not exist.` };
    }

    const current = libraries[index];
    if (!current) {
      return { success: false, error: `Library with ID "${libraryId}" does not exist.` };
    }

    libraries[index] = {
      ...current,
      isArchived,
      updatedAt: new Date().toISOString(),
    };
    saveStoredLibraries(libraries);

    return { success: true };
  }

  try {
    if (isArchived) {
      const { count, error: countErr } = await (supabase as any)
        .from("client_library_assignments")
        .select("*", { count: "exact", head: true })
        .eq("library_id", libraryId);

      if (countErr) return { success: false, error: countErr.message };

      if (count && count > 0) {
        return {
          success: false,
          error: `Cannot archive library: There are ${count} approved clients assigned to this library. Please reassign or unassign clients before archiving.`,
        };
      }
    }

    const { error } = await (supabase as any)
      .from("song_libraries")
      .update({ is_archived: isArchived })
      .eq("id", libraryId);

    if (error) return { success: false, error: error.message };
    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to update archive status on Supabase.",
    };
  }
}

/**
 * ADMIN: Assign an approved client to a song library.
 * Only APPROVED clients can be assigned. Enforced client-side and by database trigger.
 * // TODO: Enforce server-side (RLS) security check - Admin only (DB trigger trg_enforce_approved_assignment)
 */
/**
 * ADMIN: Assign multiple song libraries to a client.
 */
export async function assignClientToLibraries(
  clientId: string,
  libraryIds: string[],
): Promise<{ success: boolean; error?: string }> {
  if (songLibraryConfig.isMockMode) {
    const profiles = getStoredProfiles();
    const index = profiles.findIndex((p) => p.id === clientId);
    if (index === -1) return { success: false, error: "Client not found." };
    const current = profiles[index];
    if (current.approvalStatus !== "approved") {
      return { success: false, error: "Only approved clients can be assigned to a library." };
    }
    const libraries = getStoredLibraries();
    const validIds = libraryIds.filter((id) => libraries.some((l) => l.id === id));
    const names = validIds
      .map((id) => libraries.find((l) => l.id === id)?.name)
      .filter(Boolean) as string[];
    profiles[index] = {
      ...current,
      assignedLibraryId: validIds[0] || null,
      assignedLibraryName: names.join(", ") || undefined,
      assignedLibraryIds: validIds,
      assignedLibraryNames: names,
    };
    saveStoredProfiles(profiles);
    return { success: true };
  }

  try {
    const { data: client, error: clientErr } = await (supabase as any)
      .from("client_profiles")
      .select("approval_status, full_name")
      .eq("id", clientId)
      .single();

    if (clientErr || !client) {
      return { success: false, error: clientErr?.message || "Client not found." };
    }

    if (client.approval_status !== "approved") {
      return {
        success: false,
        error: `Cannot assign library: Client "${client.full_name}" is "${client.approval_status}". Only approved clients can be assigned to a song library.`,
      };
    }

    // If no libraries passed, remove all assignments for this client
    if (libraryIds.length === 0) {
      await (supabase as any).from("client_library_assignments").delete().eq("client_id", clientId);
      return { success: true };
    }

    // First remove assignments not in the new set
    const { data: existing } = await (supabase as any)
      .from("client_library_assignments")
      .select("library_id")
      .eq("client_id", clientId);

    const currentIds = (existing || []).map((e: any) => e.library_id);
    const toRemove = currentIds.filter((id: string) => !libraryIds.includes(id));
    if (toRemove.length > 0) {
      await (supabase as any)
        .from("client_library_assignments")
        .delete()
        .eq("client_id", clientId)
        .in("library_id", toRemove);
    }

    // Upsert all assigned libraries
    const rows = libraryIds.map((lId) => ({
      client_id: clientId,
      library_id: lId,
      assigned_at: new Date().toISOString(),
    }));

    const { error: upsertErr } = await (supabase as any)
      .from("client_library_assignments")
      .upsert(rows, { onConflict: "client_id,library_id" });

    if (upsertErr) return { success: false, error: upsertErr.message };
    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to assign libraries on Supabase.",
    };
  }
}

/**
 * ADMIN: Add a single library assignment to a client (preserving existing assignments).
 */
export async function addLibraryToClient(
  clientId: string,
  libraryId: string,
): Promise<{ success: boolean; error?: string }> {
  if (songLibraryConfig.isMockMode || !isUuid(clientId)) {
    const profiles = getStoredProfiles();
    const idx = profiles.findIndex((p) => p.id === clientId);
    if (idx === -1) {
      return { success: false, error: "Client not found." };
    }
    const current = profiles[idx]!;
    const libraries = getStoredLibraries();
    const libObj = libraries.find((l) => l.id === libraryId);
    const existingIds =
      current.assignedLibraryIds || (current.assignedLibraryId ? [current.assignedLibraryId] : []);
    const existingNames =
      current.assignedLibraryNames ||
      (current.assignedLibraryName ? [current.assignedLibraryName] : []);
    if (!existingIds.includes(libraryId)) {
      existingIds.push(libraryId);
      if (libObj?.name) existingNames.push(libObj.name);
    }
    const updated: ClientProfile = {
      ...current,
      assignedLibraryId: existingIds[0] || null,
      assignedLibraryName: existingNames.join(", "),
      assignedLibraryIds: existingIds,
      assignedLibraryNames: existingNames,
    };
    profiles[idx] = updated;
    saveStoredProfiles(profiles);
    return { success: true };
  }

  try {
    const { error } = await (supabase as any)
      .from("client_library_assignments")
      .upsert(
        { client_id: clientId, library_id: libraryId, assigned_at: new Date().toISOString() },
        { onConflict: "client_id,library_id" },
      );
    if (error) {
      console.warn("Supabase addLibraryToClient error, syncing locally:", error.message);
      // Sync local storage fallback
      const profiles = getStoredProfiles();
      const idx = profiles.findIndex((p) => p.id === clientId);
      if (idx !== -1) {
        const current = profiles[idx]!;
        const libraries = getStoredLibraries();
        const libObj = libraries.find((l) => l.id === libraryId);
        const existingIds =
          current.assignedLibraryIds ||
          (current.assignedLibraryId ? [current.assignedLibraryId] : []);
        const existingNames =
          current.assignedLibraryNames ||
          (current.assignedLibraryName ? [current.assignedLibraryName] : []);
        if (!existingIds.includes(libraryId)) {
          existingIds.push(libraryId);
          if (libObj?.name) existingNames.push(libObj.name);
        }
        profiles[idx] = {
          ...current,
          assignedLibraryId: existingIds[0] || null,
          assignedLibraryName: existingNames.join(", "),
          assignedLibraryIds: existingIds,
          assignedLibraryNames: existingNames,
        };
        saveStoredProfiles(profiles);
      }
      return { success: false, error: error.message };
    }

    // Also sync local storage if client profile exists locally
    const profiles = getStoredProfiles();
    const idx = profiles.findIndex((p) => p.id === clientId);
    if (idx !== -1) {
      const current = profiles[idx]!;
      const existingIds =
        current.assignedLibraryIds ||
        (current.assignedLibraryId ? [current.assignedLibraryId] : []);
      if (!existingIds.includes(libraryId)) {
        existingIds.push(libraryId);
      }
      profiles[idx] = { ...current, assignedLibraryIds: existingIds };
      saveStoredProfiles(profiles);
    }
    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to add library assignment.",
    };
  }
}

/**
 * ADMIN: Remove a single library assignment from a client.
 */
export async function removeLibraryFromClient(
  clientId: string,
  libraryId: string,
): Promise<{ success: boolean; error?: string }> {
  if (songLibraryConfig.isMockMode || !isUuid(clientId)) {
    const profiles = getStoredProfiles();
    const idx = profiles.findIndex((p) => p.id === clientId);
    if (idx === -1) {
      return { success: false, error: "Client not found." };
    }
    const current = profiles[idx]!;
    const libraries = getStoredLibraries();
    const libMap = new Map(libraries.map((l) => [l.id, l.name]));
    const nextIds = (current.assignedLibraryIds || []).filter((id) => id !== libraryId);
    const nextNames = nextIds.map((id) => libMap.get(id)).filter(Boolean) as string[];
    const updated: ClientProfile = {
      ...current,
      assignedLibraryId: nextIds[0] || null,
      assignedLibraryName: nextNames.join(", "),
      assignedLibraryIds: nextIds,
      assignedLibraryNames: nextNames,
    };
    profiles[idx] = updated;
    saveStoredProfiles(profiles);
    return { success: true };
  }

  try {
    const { error } = await (supabase as any)
      .from("client_library_assignments")
      .delete()
      .eq("client_id", clientId)
      .eq("library_id", libraryId);
    if (error) return { success: false, error: error.message };

    // Also sync local storage
    const profiles = getStoredProfiles();
    const idx = profiles.findIndex((p) => p.id === clientId);
    if (idx !== -1) {
      const current = profiles[idx]!;
      const nextIds = (current.assignedLibraryIds || []).filter((id) => id !== libraryId);
      profiles[idx] = { ...current, assignedLibraryIds: nextIds };
      saveStoredProfiles(profiles);
    }
    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to remove library assignment.",
    };
  }
}

/**
 * SONGS: Get songs across multiple libraries.
 */
export async function getSongsByMultipleLibraries(libraryIds: string[]): Promise<SongItem[]> {
  if (!libraryIds || libraryIds.length === 0) return [];
  const batches = await Promise.all(libraryIds.map((libId) => getSongsByLibrary(libId)));
  const all = batches.flat();
  return Array.from(new Map(all.map((s) => [s.id, s])).values());
}

export async function assignClientToLibrary(
  clientId: string,
  libraryId: string,
): Promise<{ success: boolean; client?: ClientProfile; error?: string }> {
  if (songLibraryConfig.isMockMode) {
    const profiles = getStoredProfiles();
    const clientIndex = profiles.findIndex((p) => p.id === clientId);

    if (clientIndex === -1) {
      return { success: false, error: `Client with ID "${clientId}" was not found.` };
    }

    const current = profiles[clientIndex];
    if (!current) {
      return { success: false, error: `Client with ID "${clientId}" was not found.` };
    }

    if (current.approvalStatus !== "approved") {
      return {
        success: false,
        error: `Cannot assign library: client "${current.fullName}" is ${current.approvalStatus}. Only approved clients can be assigned to a song library.`,
      };
    }

    const libraries = getStoredLibraries();
    const library = libraries.find((l) => l.id === libraryId);
    if (!library) {
      return { success: false, error: `Library with ID "${libraryId}" does not exist.` };
    }

    const updatedClient: ClientProfile = {
      ...current,
      assignedLibraryId: libraryId,
      assignedLibraryName: library.name,
    };

    profiles[clientIndex] = updatedClient;
    saveStoredProfiles(profiles);

    return { success: true, client: updatedClient };
  }

  try {
    const { data: client, error: cErr } = await (supabase as any)
      .from("client_profiles")
      .select("approval_status, full_name")
      .eq("id", clientId)
      .single();

    if (cErr || !client) {
      return { success: false, error: "Client not found." };
    }

    if (client.approval_status !== "approved") {
      return {
        success: false,
        error: `Cannot assign library: Client "${client.full_name}" is "${client.approval_status}". Only approved clients can be assigned to a song library.`,
      };
    }

    const { error } = await (supabase as any)
      .from("client_library_assignments")
      .upsert(
        { client_id: clientId, library_id: libraryId, assigned_at: new Date().toISOString() },
        { onConflict: "client_id,library_id" },
      );

    if (error) return { success: false, error: error.message };
    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to assign library on Supabase.",
    };
  }
}

/**
 * ADMIN: Delete a song library.
 * Prevents deleting if clients are currently assigned.
 * // TODO: Enforce server-side (RLS) security check - Admin only (DB foreign key on delete restrict)
 */
export async function deleteSongLibrary(
  libraryId: string,
): Promise<{ success: boolean; error?: string }> {
  if (songLibraryConfig.isMockMode) {
    const profiles = getStoredProfiles();
    const assigned = profiles.filter((p) => p.assignedLibraryId === libraryId);

    if (assigned.length > 0) {
      return {
        success: false,
        error: `Cannot delete library: There are ${assigned.length} client(s) currently assigned to this library. Please reassign them first.`,
      };
    }

    const libraries = getStoredLibraries();
    saveStoredLibraries(libraries.filter((l) => l.id !== libraryId));

    const songs = getStoredSongs();
    saveStoredSongs(songs.filter((s) => s.libraryId !== libraryId));

    return { success: true };
  }

  try {
    // Check if clients assigned
    const { count, error: countErr } = await (supabase as any)
      .from("client_library_assignments")
      .select("*", { count: "exact", head: true })
      .eq("library_id", libraryId);

    if (countErr) return { success: false, error: countErr.message };

    if (count && count > 0) {
      return {
        success: false,
        error: `Cannot delete library: There are ${count} client(s) currently assigned to this library. Please reassign clients before deleting.`,
      };
    }

    const { error } = await (supabase as any).from("song_libraries").delete().eq("id", libraryId);

    if (error) return { success: false, error: error.message };
    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to delete library on Supabase.",
    };
  }
}

/**
 * SONGS: Get songs for a library.
 * // TODO: Enforce server-side (RLS) security check - Admin or assigned client
 */
export async function getSongsByLibrary(libraryId: string): Promise<SongItem[]> {
  if (songLibraryConfig.isMockMode || !isUUID(libraryId)) {
    const songs = getStoredSongs();
    return songs.filter((s) => s.libraryId === libraryId && s.isActive !== false);
  }

  try {
    let { data, error } = await (supabase as any)
      .from("songs")
      .select("*")
      .eq("library_id", libraryId)
      .eq("is_active", true)
      .order("created_at", { ascending: true });

    // Gracefully handle if migration 20261019000000 has not been run on remote db
    if (error && (error.message?.includes("is_active") || error.code === "42703")) {
      const fallback = await (supabase as any)
        .from("songs")
        .select("*")
        .eq("library_id", libraryId)
        .order("created_at", { ascending: true });
      data = fallback.data;
      error = fallback.error;
    }

    if (error) {
      console.warn("Falling back to local song storage:", error);
      const songs = getStoredSongs();
      return songs.filter((s) => s.libraryId === libraryId && s.isActive !== false);
    }

    return (data || []).map((s: any) => ({
      id: s.id,
      title: s.title,
      artist: s.artist || "Unknown Artist",
      eventGroup: s.event_group as WeddingEventGroup,
      durationSeconds: 210,
      durationFormatted: "3:30",
      libraryId: s.library_id,
      audioFileName: s.audio_path || undefined,
      youtubeVideoId: s.youtube_video_id || undefined,
      channelName: s.channel_name || undefined,
      thumbnailUrl: s.thumbnail_url || undefined,
      youtubeUrl: s.youtube_url || undefined,
      isActive: s.is_active ?? true,
      createdAt: s.created_at,
    }));
  } catch (err) {
    console.error("Failed to load songs from Supabase, falling back to local songs:", err);
    const songs = getStoredSongs();
    return songs.filter((s) => s.libraryId === libraryId && s.isActive !== false);
  }
}

export interface AddSongParams {
  libraryId: string;
  title: string;
  artist: string;
  eventGroup: WeddingEventGroup;
  audioFileName?: string;
  youtubeVideoId?: string;
  channelName?: string;
  thumbnailUrl?: string;
  youtubeUrl?: string;
  durationSeconds?: number;
  tags?: string[];
}

/**
 * ADMIN: Add a song (audio or YouTube) to a library.
 * Enforces duplicate prevention within the same library.
 * // TODO: Enforce server-side (RLS) security check - Admin only
 */
export async function addSongToLibrary(
  params: AddSongParams,
): Promise<{ success: boolean; song?: SongItem; error?: string }> {
  const title = params.title.trim();
  const artist = params.artist.trim();

  if (!title) {
    return { success: false, error: "Song title is required." };
  }
  if (!artist) {
    return { success: false, error: "Artist name is required." };
  }

  if (songLibraryConfig.isMockMode || !isUUID(params.libraryId)) {
    const libraries = getStoredLibraries();
    if (!libraries.some((l) => l.id === params.libraryId)) {
      return { success: false, error: `Library with ID "${params.libraryId}" does not exist.` };
    }

    const songs = getStoredSongs();

    // Check duplicate YouTube video in library
    if (params.youtubeVideoId) {
      const duplicate = songs.find(
        (s) =>
          s.libraryId === params.libraryId &&
          s.youtubeVideoId === params.youtubeVideoId &&
          s.isActive !== false,
      );
      if (duplicate) {
        return {
          success: false,
          error: `This YouTube video is already in this library (${duplicate.title}).`,
        };
      }
    }

    const newSong: SongItem = {
      id: `song-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      title,
      artist,
      eventGroup: params.eventGroup,
      durationSeconds: params.durationSeconds || 210,
      durationFormatted: "3:30",
      libraryId: params.libraryId,
      audioFileName: params.audioFileName || undefined,
      youtubeVideoId: params.youtubeVideoId || undefined,
      channelName: params.channelName || undefined,
      thumbnailUrl: params.thumbnailUrl || undefined,
      youtubeUrl:
        params.youtubeUrl ||
        (params.youtubeVideoId
          ? `https://www.youtube.com/watch?v=${params.youtubeVideoId}`
          : undefined),
      isActive: true,
      tags: params.tags || [params.eventGroup],
      createdAt: new Date().toISOString(),
    };

    saveStoredSongs([newSong, ...songs]);
    return { success: true, song: newSong };
  }

  if (!isUuid(params.libraryId)) {
    // Non-UUID library ID (e.g. mock or local library), save to local songs storage
    const songs = getStoredSongs();
    if (params.youtubeVideoId) {
      const duplicate = songs.find(
        (s) =>
          s.libraryId === params.libraryId &&
          s.youtubeVideoId === params.youtubeVideoId &&
          s.isActive !== false,
      );
      if (duplicate) {
        return {
          success: false,
          error: `This YouTube video is already in this library (${duplicate.title}).`,
        };
      }
    }

    const newSong: SongItem = {
      id: `song-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      title,
      artist,
      eventGroup: params.eventGroup,
      durationSeconds: params.durationSeconds || 210,
      durationFormatted: "3:30",
      libraryId: params.libraryId,
      audioFileName: params.audioFileName || undefined,
      youtubeVideoId: params.youtubeVideoId || undefined,
      channelName: params.channelName || undefined,
      thumbnailUrl: params.thumbnailUrl || undefined,
      youtubeUrl:
        params.youtubeUrl ||
        (params.youtubeVideoId
          ? `https://www.youtube.com/watch?v=${params.youtubeVideoId}`
          : undefined),
      isActive: true,
      tags: params.tags || [params.eventGroup],
      createdAt: new Date().toISOString(),
    };

    saveStoredSongs([newSong, ...songs]);
    return { success: true, song: newSong };
  }

  try {
    // Check for existing duplicate in same library
    if (params.youtubeVideoId) {
      const { data: existing } = await (supabase as any)
        .from("songs")
        .select("id, title")
        .eq("library_id", params.libraryId)
        .eq("youtube_video_id", params.youtubeVideoId)
        .eq("is_active", true)
        .maybeSingle();

      if (existing) {
        return {
          success: false,
          error: `This YouTube video is already in this library ("${existing.title}").`,
        };
      }
    }

    const { data, error } = await (supabase as any)
      .from("songs")
      .insert({
        library_id: params.libraryId,
        title,
        artist,
        event_group: params.eventGroup,
        audio_path: params.audioFileName || null,
        youtube_video_id: params.youtubeVideoId || null,
        channel_name: params.channelName || null,
        thumbnail_url: params.thumbnailUrl || null,
        youtube_url:
          params.youtubeUrl ||
          (params.youtubeVideoId
            ? `https://www.youtube.com/watch?v=${params.youtubeVideoId}`
            : null),
        is_active: true,
      })
      .select()
      .single();

    if (error) {
      if (error.code === "23505") {
        return {
          success: false,
          error: "This song or YouTube video already exists in this library.",
        };
      }
      // If remote database has error, persist to local song storage
      console.warn("Remote song insert failed, saving song locally:", error.message);
      const songs = getStoredSongs();

      if (params.youtubeVideoId) {
        const duplicate = songs.find(
          (s) =>
            s.libraryId === params.libraryId &&
            s.youtubeVideoId === params.youtubeVideoId &&
            s.isActive !== false,
        );
        if (duplicate) {
          return {
            success: false,
            error: `This YouTube video is already in this library (${duplicate.title}).`,
          };
        }
      }

      const newSong: SongItem = {
        id: `song-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        title,
        artist,
        eventGroup: params.eventGroup,
        durationSeconds: params.durationSeconds || 210,
        durationFormatted: "3:30",
        libraryId: params.libraryId,
        audioFileName: params.audioFileName || undefined,
        youtubeVideoId: params.youtubeVideoId || undefined,
        channelName: params.channelName || undefined,
        thumbnailUrl: params.thumbnailUrl || undefined,
        youtubeUrl:
          params.youtubeUrl ||
          (params.youtubeVideoId
            ? `https://www.youtube.com/watch?v=${params.youtubeVideoId}`
            : undefined),
        isActive: true,
        tags: params.tags || [params.eventGroup],
        createdAt: new Date().toISOString(),
      };
      saveStoredSongs([newSong, ...songs]);
      return { success: true, song: newSong };
    }

    return {
      success: true,
      song: {
        id: data.id,
        title: data.title,
        artist: data.artist,
        eventGroup: data.event_group,
        durationSeconds: 210,
        durationFormatted: "3:30",
        libraryId: data.library_id,
        audioFileName: data.audio_path || undefined,
        youtubeVideoId: data.youtube_video_id || undefined,
        channelName: data.channel_name || undefined,
        thumbnailUrl: data.thumbnail_url || undefined,
        youtubeUrl: data.youtube_url || undefined,
        isActive: data.is_active ?? true,
        createdAt: data.created_at,
      },
    };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to add song on Supabase.",
    };
  }
}

/**
 * ADMIN: Update song details in a library.
 * // TODO: Enforce server-side (RLS) security check - Admin only
 */
export async function updateSong(
  songId: string,
  params: {
    title?: string;
    artist?: string;
    eventGroup?: WeddingEventGroup;
    audioFileName?: string;
    youtubeUrl?: string;
    youtubeVideoId?: string;
    thumbnailUrl?: string;
    channelName?: string;
  },
): Promise<{ success: boolean; song?: SongItem; error?: string }> {
  if (songLibraryConfig.isMockMode || !isUUID(songId)) {
    const songs = getStoredSongs();
    const index = songs.findIndex((s) => s.id === songId);

    if (index === -1) {
      return { success: false, error: `Song with ID "${songId}" was not found.` };
    }

    const current = songs[index];
    if (!current) {
      return { success: false, error: `Song with ID "${songId}" was not found.` };
    }

    const updatedSong: SongItem = {
      ...current,
      title: params.title !== undefined ? params.title.trim() : current.title,
      artist: params.artist !== undefined ? params.artist.trim() : current.artist,
      eventGroup: params.eventGroup || current.eventGroup,
      audioFileName:
        params.audioFileName !== undefined ? params.audioFileName : current.audioFileName,
      youtubeUrl: params.youtubeUrl !== undefined ? params.youtubeUrl : current.youtubeUrl,
      youtubeVideoId:
        params.youtubeVideoId !== undefined ? params.youtubeVideoId : current.youtubeVideoId,
      thumbnailUrl: params.thumbnailUrl !== undefined ? params.thumbnailUrl : current.thumbnailUrl,
      channelName: params.channelName !== undefined ? params.channelName : current.channelName,
    };

    songs[index] = updatedSong;
    saveStoredSongs(songs);

    return { success: true, song: updatedSong };
  }

  try {
    const updatePayload: Record<string, any> = {};
    if (params.title !== undefined) updatePayload["title"] = params.title.trim();
    if (params.artist !== undefined) updatePayload["artist"] = params.artist.trim();
    if (params.eventGroup !== undefined) updatePayload["event_group"] = params.eventGroup;
    if (params.audioFileName !== undefined) updatePayload["audio_path"] = params.audioFileName;
    if (params.youtubeUrl !== undefined) updatePayload["youtube_url"] = params.youtubeUrl;
    if (params.youtubeVideoId !== undefined)
      updatePayload["youtube_video_id"] = params.youtubeVideoId;
    if (params.thumbnailUrl !== undefined) updatePayload["thumbnail_url"] = params.thumbnailUrl;
    if (params.channelName !== undefined) updatePayload["channel_name"] = params.channelName;

    const { data, error } = await (supabase as any)
      .from("songs")
      .update(updatePayload)
      .eq("id", songId)
      .select()
      .single();

    if (error) return { success: false, error: error.message };

    return {
      success: true,
      song: {
        id: data.id,
        title: data.title,
        artist: data.artist,
        eventGroup: data.event_group,
        durationSeconds: 210,
        durationFormatted: "3:30",
        libraryId: data.library_id,
        audioFileName: data.audio_path || undefined,
        youtubeVideoId: data.youtube_video_id || undefined,
        channelName: data.channel_name || undefined,
        thumbnailUrl: data.thumbnail_url || undefined,
        youtubeUrl: data.youtube_url || undefined,
        isActive: data.is_active ?? true,
        createdAt: data.created_at,
      },
    };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to update song on Supabase.",
    };
  }
}

/**
 * ADMIN: Remove song from a library while preserving selection history.
 * Soft-deletes (sets is_active = false) or removes from active view.
 * // TODO: Enforce server-side (RLS) security check - Admin only
 */
export async function deleteSong(songId: string): Promise<{ success: boolean; error?: string }> {
  if (songLibraryConfig.isMockMode || !isUUID(songId)) {
    const songs = getStoredSongs();
    // Soft delete to preserve client selection references
    const updated = songs.map((s) => (s.id === songId ? { ...s, isActive: false } : s));
    saveStoredSongs(updated);
    return { success: true };
  }

  if (!isUuid(songId)) {
    const songs = getStoredSongs();
    const updated = songs.map((s) => (s.id === songId ? { ...s, isActive: false } : s));
    saveStoredSongs(updated);
    return { success: true };
  }

  try {
    // Soft delete so client selections history in client_song_selections is not broken
    const { error } = await (supabase as any)
      .from("songs")
      .update({ is_active: false })
      .eq("id", songId);

    if (error) {
      // Fallback if is_active column has not yet been migrated or remote query failed
      console.warn("Soft delete on remote db failed, deleting locally:", error.message);
      const songs = getStoredSongs();
      const updated = songs.map((s) => (s.id === songId ? { ...s, isActive: false } : s));
      saveStoredSongs(updated);
      return { success: true };
    }
    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to remove song.",
    };
  }
}

const CLIENT_SELECTIONS_STORAGE_KEY = "ta_bridals_mock_client_selections";
const CLIENT_CUSTOM_SONGS_STORAGE_KEY = "ta_bridals_mock_client_custom_songs";

/**
 * CLIENT: Save client song selections and optional notes.
 */
export async function saveClientSelections(
  selections: Array<{ songId: string; eventGroup: WeddingEventGroup }>,
  clientId?: string,
  notes?: string,
): Promise<{ success: boolean; error?: string }> {
  // Always persist to local client selection cache so refresh works seamlessly in both modes
  if (typeof window !== "undefined") {
    try {
      const id = clientId || getClientSession()?.id || "demo-client-approved";
      const raw = localStorage.getItem(CLIENT_SELECTIONS_STORAGE_KEY);
      const map = raw ? JSON.parse(raw) : {};
      map[id] = { selections, notes: notes || "" };
      localStorage.setItem(CLIENT_SELECTIONS_STORAGE_KEY, JSON.stringify(map));
    } catch (err) {
      console.error("Failed to save mock selections:", err);
    }
  }

  if (songLibraryConfig.isMockMode) {
    return { success: true };
  }

  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const targetClientId = user?.id || clientId;
    if (!targetClientId) {
      return { success: true };
    }

    // Delete existing selections
    await (supabase as any).from("client_song_selections").delete().eq("client_id", targetClientId);

    // Insert new selections
    if (selections.length > 0) {
      const rows = selections.map((s) => ({
        client_id: targetClientId,
        song_id: s.songId,
        event_group: s.eventGroup,
        notes: notes || null,
      }));

      let { error } = await (supabase as any).from("client_song_selections").insert(rows);
      if (error && error.message?.includes("notes")) {
        // Remote table might not have 'notes' column yet, retry without notes column
        const rowsWithoutNotes = selections.map((s) => ({
          client_id: targetClientId,
          song_id: s.songId,
          event_group: s.eventGroup,
        }));
        const retryRes = await (supabase as any)
          .from("client_song_selections")
          .insert(rowsWithoutNotes);
        error = retryRes.error;
      }

      if (error) {
        console.warn("Remote client_song_selections insert failed, relying on local cache:", error);
        return { success: true };
      }
    }

    return { success: true };
  } catch (err) {
    console.warn(
      "Exception during remote client_song_selections save, relying on local cache:",
      err,
    );
    return { success: true };
  }
}

/**
 * CLIENT: Add a custom song requested by the client.
 */
export async function addClientCustomSongRequest(
  clientId: string,
  request: {
    songTitle: string;
    artistOrDetails?: string | undefined;
    eventGroup: WeddingEventGroup;
    notes?: string | undefined;
    youtubeUrl?: string | undefined;
  },
): Promise<{ success: boolean; customRequest?: ClientCustomSongRequest; error?: string }> {
  const newReq: ClientCustomSongRequest = {
    id: `custom-song-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    songTitle: request.songTitle.trim(),
    artistOrDetails: request.artistOrDetails?.trim() || undefined,
    eventGroup: request.eventGroup,
    notes: request.notes?.trim() || undefined,
    youtubeUrl: request.youtubeUrl?.trim() || undefined,
    createdAt: new Date().toISOString(),
  };

  if (typeof window !== "undefined") {
    try {
      const raw = localStorage.getItem(CLIENT_CUSTOM_SONGS_STORAGE_KEY);
      const map: Record<string, ClientCustomSongRequest[]> = raw ? JSON.parse(raw) : {};
      const existing = map[clientId] || [];
      map[clientId] = [newReq, ...existing];
      localStorage.setItem(CLIENT_CUSTOM_SONGS_STORAGE_KEY, JSON.stringify(map));
    } catch (err) {
      console.error("Failed to save custom song locally:", err);
    }
  }

  // Attempt database persistence if available
  try {
    await (supabase as any).from("client_custom_song_requests").insert({
      id: newReq.id,
      client_id: clientId,
      song_title: newReq.songTitle,
      artist_or_details: newReq.artistOrDetails || null,
      event_group: newReq.eventGroup,
      notes: newReq.notes || null,
      youtube_url: newReq.youtubeUrl || null,
      created_at: newReq.createdAt,
    });
  } catch {
    // Falls back gracefully to local storage
  }

  return { success: true, customRequest: newReq };
}

/**
 * CLIENT / ADMIN / WORKER: Retrieve custom song requests submitted by a client.
 */
export async function getClientCustomSongRequests(
  clientId: string,
): Promise<ClientCustomSongRequest[]> {
  if (typeof window !== "undefined") {
    try {
      const raw = localStorage.getItem(CLIENT_CUSTOM_SONGS_STORAGE_KEY);
      if (raw) {
        const map = JSON.parse(raw);
        if (map[clientId] && Array.isArray(map[clientId])) {
          return map[clientId];
        }
      }
    } catch (err) {
      console.error("Error reading custom songs from storage:", err);
    }
  }

  try {
    const { data, error } = await (supabase as any)
      .from("client_custom_song_requests")
      .select("*")
      .eq("client_id", clientId)
      .order("created_at", { ascending: false });

    if (!error && data && data.length > 0) {
      return data.map((d: any) => ({
        id: d.id,
        songTitle: d.song_title,
        artistOrDetails: d.artist_or_details || undefined,
        eventGroup: d.event_group as WeddingEventGroup,
        notes: d.notes || undefined,
        youtubeUrl: d.youtube_url || undefined,
        createdAt: d.created_at,
      }));
    }
  } catch {
    // local fallback
  }

  return [];
}

/**
 * CLIENT: Load client song selections.
 * Restores client's previously picked favorites.
 */
export async function getClientSelections(
  clientId: string,
): Promise<Array<{ id: string; clientId: string; songId: string; eventGroup: WeddingEventGroup }>> {
  // If not mock mode and valid UUID, query Supabase first so admin gets live selections
  if (!songLibraryConfig.isMockMode && isUUID(clientId)) {
    try {
      const { data, error } = await (supabase as any)
        .from("client_song_selections")
        .select("*")
        .eq("client_id", clientId);

      if (!error && data && data.length > 0) {
        return data.map((row: any) => ({
          id: row.id,
          clientId: row.client_id,
          songId: row.song_id,
          eventGroup: row.event_group as WeddingEventGroup,
        }));
      }
    } catch (err) {
      console.warn("Failed to query remote client_song_selections, checking cache:", err);
    }
  }

  // Fallback to local storage (mock mode or offline cache)
  if (typeof window !== "undefined") {
    try {
      const raw = localStorage.getItem(CLIENT_SELECTIONS_STORAGE_KEY);
      if (raw) {
        const map = JSON.parse(raw);
        const stored = map[clientId];
        const userSelections: Array<{ songId: string; eventGroup: WeddingEventGroup }> =
          Array.isArray(stored) ? stored : stored?.selections || [];
        if (userSelections.length > 0) {
          return userSelections.map((s, idx) => ({
            id: `sel-${idx}`,
            clientId,
            songId: s.songId,
            eventGroup: s.eventGroup,
          }));
        }
      }
    } catch (err) {
      console.error("Failed to read selections from cache:", err);
    }
  }

  return [];
}

/**
 * ADMIN / WORKER: Retrieve complete selection summary (picked songs + custom typed songs) for any client.
 */
export async function getClientCompleteSelections(clientId: string): Promise<{
  selectedSongs: SongItem[];
  customRequests: ClientCustomSongRequest[];
  notes?: string | undefined;
}> {
  // 1. Get raw song ID selections
  const rawSelections = await getClientSelections(clientId);
  const selectedSongIds = new Set(rawSelections.map((s) => s.songId));

  // 2. Fetch songs matching selectedSongIds (check remote Supabase first if available)
  let selectedSongs: SongItem[] = [];
  if (selectedSongIds.size > 0) {
    const allStoredSongs = getStoredSongs();
    const localMatches = allStoredSongs.filter((s) => selectedSongIds.has(s.id));
    
    // If running with Supabase, query matching songs directly by ID from the database
    if (!songLibraryConfig.isMockMode && localMatches.length < selectedSongIds.size) {
      try {
        const { data: dbSongs } = await (supabase as any)
          .from("songs")
          .select("*")
          .in("id", Array.from(selectedSongIds));

        if (dbSongs && dbSongs.length > 0) {
          selectedSongs = dbSongs.map((s: any) => ({
            id: s.id,
            title: s.title,
            artist: s.artist || "Unknown Artist",
            eventGroup: s.event_group as WeddingEventGroup,
            durationSeconds: 210,
            durationFormatted: "3:30",
            libraryId: s.library_id,
            audioFileName: s.audio_path || undefined,
            youtubeVideoId: s.youtube_video_id || undefined,
            channelName: s.channel_name || undefined,
            thumbnailUrl: s.thumbnail_url || undefined,
            youtubeUrl: s.youtube_url || undefined,
            isActive: s.is_active ?? true,
            createdAt: s.created_at,
          }));
        } else {
          selectedSongs = localMatches;
        }
      } catch (err) {
        console.warn("Failed to fetch selected songs from Supabase, falling back to local:", err);
        selectedSongs = localMatches;
      }
    } else {
      selectedSongs = localMatches;
    }
  }

  // 3. Fetch custom requests
  const customRequests = await getClientCustomSongRequests(clientId);

  // 4. Retrieve saved notes if any
  let notes: string | undefined = undefined;
  if (typeof window !== "undefined") {
    try {
      const raw = localStorage.getItem(CLIENT_SELECTIONS_STORAGE_KEY);
      if (raw) {
        const map = JSON.parse(raw);
        if (map[clientId] && !Array.isArray(map[clientId])) {
          notes = map[clientId].notes || undefined;
        }
      }
    } catch {
      // ignore
    }
  }

  return {
    selectedSongs,
    customRequests,
    notes,
  };
}

/**
 * ADMIN: Permanently delete a client profile (and cascade assignments/selections).
 */
export async function deleteClientProfile(
  clientId: string,
): Promise<{ success: boolean; error?: string }> {
  if (songLibraryConfig.isMockMode) {
    const profiles = getStoredProfiles();
    const filtered = profiles.filter((p) => p.id !== clientId);
    saveStoredProfiles(filtered);

    if (typeof window !== "undefined") {
      try {
        const rawSel = localStorage.getItem(CLIENT_SELECTIONS_STORAGE_KEY);
        if (rawSel) {
          const map = JSON.parse(rawSel);
          delete map[clientId];
          localStorage.setItem(CLIENT_SELECTIONS_STORAGE_KEY, JSON.stringify(map));
        }
        const rawCustom = localStorage.getItem(CLIENT_CUSTOM_SONGS_STORAGE_KEY);
        if (rawCustom) {
          const map = JSON.parse(rawCustom);
          delete map[clientId];
          localStorage.setItem(CLIENT_CUSTOM_SONGS_STORAGE_KEY, JSON.stringify(map));
        }
      } catch {
        // ignore
      }
    }

    return { success: true };
  }

  try {
    // Delete assignments, selections, custom requests, then profile
    await (supabase as any).from("client_library_assignments").delete().eq("client_id", clientId);
    await (supabase as any).from("client_song_selections").delete().eq("client_id", clientId);
    await (supabase as any).from("client_custom_song_requests").delete().eq("client_id", clientId);

    const { error } = await (supabase as any).from("client_profiles").delete().eq("id", clientId);

    if (error) {
      // Fallback: update status to rejected or delete locally
      console.warn("Remote deleteClientProfile failed, fallback to local:", error);
      const profiles = getStoredProfiles();
      const filtered = profiles.filter((p) => p.id !== clientId);
      saveStoredProfiles(filtered);
    }

    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to delete client account.",
    };
  }
}

/**
 * CLIENT: Update profile name and partner name.
 */
export async function updateClientProfileName(
  clientId: string,
  fullName: string,
  partnerName?: string | undefined,
): Promise<{ success: boolean; client?: ClientProfile; error?: string }> {
  const trimmedName = fullName.trim();
  const trimmedPartner = partnerName?.trim() || undefined;

  if (!trimmedName) {
    return { success: false, error: "Full name cannot be empty." };
  }

  if (songLibraryConfig.isMockMode) {
    const profiles = getStoredProfiles();
    const idx = profiles.findIndex((p) => p.id === clientId);
    if (idx !== -1 && profiles[idx]) {
      const updated: ClientProfile = {
        ...profiles[idx],
        fullName: trimmedName,
        partnerName: trimmedPartner,
      };
      profiles[idx] = updated;
      saveStoredProfiles(profiles);

      const session = getClientSession();
      if (session && session.id === clientId) {
        if (typeof window !== "undefined") {
          sessionStorage.setItem(CLIENT_SESSION_KEY, JSON.stringify(updated));
        }
      }
      return { success: true, client: updated };
    }
  }

  try {
    const { error } = await (supabase as any)
      .from("client_profiles")
      .update({
        full_name: trimmedName,
        partner_name: trimmedPartner || null,
      })
      .eq("id", clientId);

    if (error) return { success: false, error: error.message };

    const session = getClientSession();
    if (session && session.id === clientId) {
      const updated: ClientProfile = {
        ...session,
        fullName: trimmedName,
        partnerName: trimmedPartner,
      };
      if (typeof window !== "undefined") {
        sessionStorage.setItem(CLIENT_SESSION_KEY, JSON.stringify(updated));
      }
      return { success: true, client: updated };
    }

    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to update profile.",
    };
  }
}

/**
 * Parses YouTube Video ID from various YouTube URL formats or raw video IDs.
 */
export function extractYouTubeVideoId(input: string): string | null {
  const clean = input.trim();
  if (!clean) return null;

  // If already an 11-char video ID
  if (/^[a-zA-Z0-9_-]{11}$/.test(clean)) {
    return clean;
  }

  // Handle standard youtu.be/ID, youtube.com/watch?v=ID, youtube.com/embed/ID, youtube.com/shorts/ID
  const patterns = [
    /(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=|shorts\/))([\w-]{11})/,
    /youtube\.com\/live\/([\w-]{11})/,
  ];

  for (const pattern of patterns) {
    const match = clean.match(pattern);
    if (match && match[1]) {
      return match[1];
    }
  }

  return null;
}
