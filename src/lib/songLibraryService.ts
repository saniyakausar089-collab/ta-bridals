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
import type {
  ClientProfile,
  ClientApprovalStatus,
  SongItem,
  SongLibraryRecord,
  WeddingEventGroup,
} from "@/types/songLibrary";

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
    tags: ["High Energy", "Group Dance", "Sangeet"],
    createdAt: "2026-10-02T10:30:00.000Z",
  },
  {
    id: "song-4",
    title: "Sauda Khara Khara (Nagada Baraat Edit)",
    artist: "Sukhbir & DJ Chetas Edit",
    eventGroup: "Baraat",
    durationSeconds: 215,
    durationFormatted: "3:35",
    libraryId: "lib-royal-heritage",
    tags: ["Baraat", "Brass", "Nagada"],
    createdAt: "2026-10-02T10:45:00.000Z",
  },
  {
    id: "song-5",
    title: "Din Shagna Da (Grand Royal Entry)",
    artist: "Jasleen Royal & Strings",
    eventGroup: "Entry",
    durationSeconds: 228,
    durationFormatted: "3:48",
    libraryId: "lib-royal-heritage",
    tags: ["Bridal Entry", "Emotional", "Shehnai"],
    createdAt: "2026-10-02T11:00:00.000Z",
  },
  {
    id: "song-6",
    title: "Afreen Afreen (Nikah Acoustic Tribute)",
    artist: "Rahat Fateh Ali Khan Tribute Band",
    eventGroup: "Nikah",
    durationSeconds: 312,
    durationFormatted: "5:12",
    libraryId: "lib-royal-heritage",
    tags: ["Nikah", "Sufi", "Soulful"],
    createdAt: "2026-10-02T11:15:00.000Z",
  },
  {
    id: "song-7",
    title: "Mangalyam Tantunanena (Sacred Pheras Symphony)",
    artist: "Vedic Symphony Orchestra",
    eventGroup: "Pheras/Ceremony",
    durationSeconds: 360,
    durationFormatted: "6:00",
    libraryId: "lib-royal-heritage",
    tags: ["Pheras", "Vedic Chants", "Ceremonial"],
    createdAt: "2026-10-02T11:30:00.000Z",
  },
  {
    id: "song-8",
    title: "Kesariya (First Dance Waltz Edit)",
    artist: "Pritam & Arijit Singh (Symphonic)",
    eventGroup: "Couple Dance",
    durationSeconds: 254,
    durationFormatted: "4:14",
    libraryId: "lib-royal-heritage",
    tags: ["Couple Dance", "First Dance", "Romantic"],
    createdAt: "2026-10-02T11:45:00.000Z",
  },
  {
    id: "song-9",
    title: "Saturday Night Sundowner (Deep Lounge)",
    artist: "Studio DJ Collective",
    eventGroup: "Cocktail",
    durationSeconds: 280,
    durationFormatted: "4:40",
    libraryId: "lib-royal-heritage",
    tags: ["Cocktail", "Lounge", "Groove"],
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
    tags: ["Reception", "Party", "Finale"],
    createdAt: "2026-10-02T12:15:00.000Z",
  },
  {
    id: "song-11",
    title: "Kabira (Farewell Vidaai Symphony)",
    artist: "Rekha Bhardwaj & Tochi Raina",
    eventGroup: "Vidaai",
    durationSeconds: 262,
    durationFormatted: "4:22",
    libraryId: "lib-royal-heritage",
    tags: ["Vidaai", "Tearful", "Sentimental"],
    createdAt: "2026-10-02T12:30:00.000Z",
  },
  {
    id: "song-12",
    title: "London Thumakda (Family Celebration Mix)",
    artist: "Labh Janjua Tribute",
    eventGroup: "Other",
    durationSeconds: 210,
    durationFormatted: "3:30",
    libraryId: "lib-royal-heritage",
    tags: ["Celebration", "Family", "Bonus"],
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

    let assignedLibraryId: string | null = null;
    let assignedLibraryName: string | undefined;

    const { data: assign } = await (supabase as any)
      .from("client_library_assignments")
      .select("library_id, song_libraries(name)")
      .eq("client_id", profile.id)
      .maybeSingle();

    if (assign) {
      assignedLibraryId = assign.library_id;
      assignedLibraryName = assign.song_libraries?.name;
    }

    const clientProfile: ClientProfile = {
      id: profile.id,
      fullName: profile.full_name || "Client",
      partnerName: profile.partner_name || undefined,
      email: profile.email || user.email || "",
      weddingDate: profile.wedding_date || undefined,
      approvalStatus: profile.approval_status as ClientApprovalStatus,
      rejectionReason: profile.rejection_reason || undefined,
      assignedLibraryId,
      assignedLibraryName,
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
  email: string,
  password: string
): Promise<{ success: boolean; client: ClientProfile | null; error?: string }> {
  const normalizedEmail = email.trim().toLowerCase();

  if (!normalizedEmail || !normalizedEmail.includes("@")) {
    return { success: false, client: null, error: "Please enter a valid email address." };
  }
  if (!password) {
    return { success: false, client: null, error: "Please enter your password." };
  }

  if (songLibraryConfig.isMockMode) {
    const profiles = getStoredProfiles();
    const matched = profiles.find((p) => p.email.toLowerCase() === normalizedEmail);
    if (!matched) {
      return {
        success: false,
        client: null,
        error: "No client account found with this email. Please check your email or sign up.",
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

  // Real Supabase Auth
  try {
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email: normalizedEmail,
      password,
    });

    if (authError || !authData.user) {
      return {
        success: false,
        client: null,
        error: authError?.message || "Invalid email or password.",
      };
    }

    // Verify user is registered in client_profiles
    const { data: profile, error: profError } = await (supabase as any)
      .from("client_profiles")
      .select("*")
      .eq("id", authData.user.id)
      .maybeSingle();

    if (profError || !profile) {
      // User is not a client (e.g. staff or admin logging into client portal)
      await supabase.auth.signOut();
      return {
        success: false,
        client: null,
        error:
          "No client account found for this email. If you are studio staff, please log in through the Staff portal.",
      };
    }

    let assignedLibraryId: string | null = null;
    let assignedLibraryName: string | undefined;

    const { data: assign } = await (supabase as any)
      .from("client_library_assignments")
      .select("library_id, song_libraries(name)")
      .eq("client_id", profile.id)
      .maybeSingle();

    if (assign) {
      assignedLibraryId = assign.library_id;
      assignedLibraryName = assign.song_libraries?.name;
    }

    const clientProfile: ClientProfile = {
      id: profile.id,
      fullName: profile.full_name || "Client",
      partnerName: profile.partner_name || undefined,
      email: profile.email || authData.user.email || normalizedEmail,
      weddingDate: profile.wedding_date || undefined,
      approvalStatus: profile.approval_status as ClientApprovalStatus,
      rejectionReason: profile.rejection_reason || undefined,
      assignedLibraryId,
      assignedLibraryName,
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
}: ClientSignUpParams): Promise<{ success: boolean; client: ClientProfile | null; error?: string }> {
  const trimmedName = fullName.trim();
  const trimmedEmail = email.trim().toLowerCase();

  if (!trimmedName) {
    return { success: false, client: null, error: "Please enter your full name." };
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
      phone: phone?.trim() || undefined,
      weddingDate: weddingDate || undefined,
      approvalStatus: "pending",
      assignedLibraryId: null,
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
          full_name: trimmedName,
          partner_name: partnerName?.trim() || null,
          wedding_date: weddingDate || null,
          approval_status: "pending",
        },
        { onConflict: "id", ignoreDuplicates: true }
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

    if (data.approval_status === "approved") {
      const { data: assign } = await (supabase as any)
        .from("client_library_assignments")
        .select("library_id, song_libraries(name)")
        .eq("client_id", clientId)
        .maybeSingle();

      if (assign) {
        assignedLibraryId = assign.library_id;
        assignedLibraryName = assign.song_libraries?.name;
      }
    }

    const current = getClientSession();
    if (current && current.id === clientId) {
      const updated = {
        ...current,
        approvalStatus: data.approval_status as ClientApprovalStatus,
        rejectionReason: data.rejection_reason || undefined,
        assignedLibraryId,
        assignedLibraryName,
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

  if (songLibraryConfig.isMockMode) {
    return "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3";
  }

  try {
    const { data, error } = await supabase.storage
      .from("songs-audio")
      .createSignedUrl(audioPathOrId, songLibraryConfig.playbackTokenExpirySeconds);

    if (error || !data?.signedUrl) {
      return "";
    }
    return data.signedUrl;
  } catch {
    return "";
  }
}

/**
 * AUDIO STORAGE: Upload audio file to 'songs-audio' bucket.
 * // TODO: Enforce server-side (RLS) security check - Admin only
 */
export async function uploadSongAudio(
  libraryId: string,
  file: File
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
      upsert: false,
    });

    if (error) return { success: false, error: error.message };
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

    return profiles.map((p) => ({
      ...p,
      assignedLibraryName: p.assignedLibraryId ? libMap.get(p.assignedLibraryId) : undefined,
    }));
  }

  try {
    const [profilesRes, assignsRes] = await Promise.all([
      (supabase as any).from("client_profiles").select("*").order("created_at", { ascending: false }),
      (supabase as any).from("client_library_assignments").select("client_id, library_id, song_libraries(id, name)"),
    ]);

    if (profilesRes.error) throw profilesRes.error;

    const assignMap = new Map<string, { libraryId: string; libraryName?: string }>();
    (assignsRes.data || []).forEach((a: any) => {
      assignMap.set(a.client_id, {
        libraryId: a.library_id,
        libraryName: a.song_libraries?.name,
      });
    });

    return (profilesRes.data || []).map((p: any) => {
      const a = assignMap.get(p.id);
      return {
        id: p.id,
        fullName: p.full_name || "Client",
        partnerName: p.partner_name || undefined,
        email: p.email || "",
        weddingDate: p.wedding_date || undefined,
        approvalStatus: (p.approval_status as ClientApprovalStatus) || "pending",
        rejectionReason: p.rejection_reason || undefined,
        assignedLibraryId: a?.libraryId || null,
        assignedLibraryName: a?.libraryName || undefined,
        createdAt: p.created_at,
        reviewedAt: p.created_at,
        reviewedBy: "Studio Owner",
      };
    });
  } catch (err) {
    console.error("Failed to load clients from Supabase:", err);
    throw err;
  }
}

/**
 * ADMIN: Approve a pending or rejected client and optionally assign a song library.
 * // TODO: Enforce server-side (RLS) security check - Admin only
 */
export async function approveClient(
  clientId: string,
  libraryId?: string
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

    const updatedClient: ClientProfile = {
      ...profiles[index],
      approvalStatus: "approved",
      rejectionReason: undefined,
      assignedLibraryId: libraryId !== undefined ? libraryId : profiles[index].assignedLibraryId,
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

    if (libraryId) {
      const { error: assignError } = await (supabase as any)
        .from("client_library_assignments")
        .upsert(
          { client_id: clientId, library_id: libraryId, assigned_at: new Date().toISOString() },
          { onConflict: "client_id" }
        );

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
  libraryId?: string
): Promise<{ success: boolean; client?: ClientProfile; error?: string }> {
  return approveClient(clientId, libraryId);
}

/**
 * ADMIN: Reject a client registration with an optional reason.
 * // TODO: Enforce server-side (RLS) security check - Admin only
 */
export async function rejectClient(
  clientId: string,
  reason?: string
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

    const updatedClient: ClientProfile = {
      ...profiles[index],
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
    await (supabase as any)
      .from("client_library_assignments")
      .delete()
      .eq("client_id", clientId);

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
        (p) => p.assignedLibraryId === lib.id && p.approvalStatus === "approved"
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

    const [{ data: songs }, { data: assigns }] = await Promise.all([
      (supabase as any).from("songs").select("library_id"),
      (supabase as any).from("client_library_assignments").select("library_id"),
    ]);

    const songCountMap = new Map<string, number>();
    (songs || []).forEach((s: any) => {
      songCountMap.set(s.library_id, (songCountMap.get(s.library_id) || 0) + 1);
    });

    const clientCountMap = new Map<string, number>();
    (assigns || []).forEach((a: any) => {
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
    console.error("Failed to load song libraries from Supabase:", err);
    throw err;
  }
}

/**
 * ADMIN: Create a new song library.
 * // TODO: Enforce server-side (RLS) security check - Admin only
 */
export async function createSongLibrary(
  name: string,
  description: string
): Promise<{ success: boolean; library?: SongLibraryRecord; error?: string }> {
  const trimmedName = name.trim();
  if (!trimmedName) {
    return { success: false, error: "Please provide a valid name for the song library." };
  }

  if (songLibraryConfig.isMockMode) {
    const libraries = getStoredLibraries();
    const duplicate = libraries.find(
      (l) => l.name.toLowerCase() === trimmedName.toLowerCase()
    );
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
  description: string
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

    const updatedLibrary: SongLibraryRecord = {
      ...libraries[index],
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
  isArchived: boolean
): Promise<{ success: boolean; error?: string }> {
  if (songLibraryConfig.isMockMode) {
    const profiles = getStoredProfiles();
    const assigned = profiles.filter(
      (p) => p.assignedLibraryId === libraryId && p.approvalStatus === "approved"
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

    libraries[index] = {
      ...libraries[index],
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
export async function assignClientToLibrary(
  clientId: string,
  libraryId: string
): Promise<{ success: boolean; client?: ClientProfile; error?: string }> {
  if (songLibraryConfig.isMockMode) {
    const profiles = getStoredProfiles();
    const clientIndex = profiles.findIndex((p) => p.id === clientId);

    if (clientIndex === -1) {
      return { success: false, error: `Client with ID "${clientId}" was not found.` };
    }

    if (profiles[clientIndex].approvalStatus !== "approved") {
      return {
        success: false,
        error: `Cannot assign library: client "${profiles[clientIndex].fullName}" is ${profiles[clientIndex].approvalStatus}. Only approved clients can be assigned to a song library.`,
      };
    }

    const libraries = getStoredLibraries();
    const library = libraries.find((l) => l.id === libraryId);
    if (!library) {
      return { success: false, error: `Library with ID "${libraryId}" does not exist.` };
    }

    const updatedClient: ClientProfile = {
      ...profiles[clientIndex],
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
        { onConflict: "client_id" }
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
  libraryId: string
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

    const { error } = await (supabase as any)
      .from("song_libraries")
      .delete()
      .eq("id", libraryId);

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
  if (songLibraryConfig.isMockMode) {
    const songs = getStoredSongs();
    return songs.filter((s) => s.libraryId === libraryId);
  }

  try {
    const { data, error } = await (supabase as any)
      .from("songs")
      .select("*")
      .eq("library_id", libraryId)
      .order("created_at", { ascending: true });

    if (error) throw error;

    return (data || []).map((s: any) => ({
      id: s.id,
      title: s.title,
      artist: s.artist || "Unknown Artist",
      eventGroup: s.event_group as WeddingEventGroup,
      durationSeconds: 210,
      durationFormatted: "3:30",
      libraryId: s.library_id,
      audioFileName: s.audio_path || undefined,
      createdAt: s.created_at,
    }));
  } catch (err) {
    console.error("Failed to load songs from Supabase:", err);
    throw err;
  }
}

export interface AddSongParams {
  libraryId: string;
  title: string;
  artist: string;
  eventGroup: WeddingEventGroup;
  audioFileName?: string;
  durationSeconds?: number;
  tags?: string[];
}

/**
 * ADMIN: Add a song to a library.
 * // TODO: Enforce server-side (RLS) security check - Admin only
 */
export async function addSongToLibrary(
  params: AddSongParams
): Promise<{ success: boolean; song?: SongItem; error?: string }> {
  const title = params.title.trim();
  const artist = params.artist.trim();

  if (!title) {
    return { success: false, error: "Song title is required." };
  }
  if (!artist) {
    return { success: false, error: "Artist name is required." };
  }

  if (songLibraryConfig.isMockMode) {
    const libraries = getStoredLibraries();
    if (!libraries.some((l) => l.id === params.libraryId)) {
      return { success: false, error: `Library with ID "${params.libraryId}" does not exist.` };
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
      tags: params.tags || [params.eventGroup],
      createdAt: new Date().toISOString(),
    };

    const songs = getStoredSongs();
    saveStoredSongs([newSong, ...songs]);
    return { success: true, song: newSong };
  }

  try {
    const { data, error } = await (supabase as any)
      .from("songs")
      .insert({
        library_id: params.libraryId,
        title,
        artist,
        event_group: params.eventGroup,
        audio_path: params.audioFileName || null,
      })
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
  }
): Promise<{ success: boolean; song?: SongItem; error?: string }> {
  if (songLibraryConfig.isMockMode) {
    const songs = getStoredSongs();
    const index = songs.findIndex((s) => s.id === songId);

    if (index === -1) {
      return { success: false, error: `Song with ID "${songId}" was not found.` };
    }

    const current = songs[index];
    const updatedSong: SongItem = {
      ...current,
      title: params.title !== undefined ? params.title.trim() : current.title,
      artist: params.artist !== undefined ? params.artist.trim() : current.artist,
      eventGroup: params.eventGroup || current.eventGroup,
      audioFileName:
        params.audioFileName !== undefined ? params.audioFileName : current.audioFileName,
    };

    songs[index] = updatedSong;
    saveStoredSongs(songs);

    return { success: true, song: updatedSong };
  }

  try {
    const updatePayload: Record<string, any> = {};
    if (params.title !== undefined) updatePayload.title = params.title.trim();
    if (params.artist !== undefined) updatePayload.artist = params.artist.trim();
    if (params.eventGroup !== undefined) updatePayload.event_group = params.eventGroup;
    if (params.audioFileName !== undefined) updatePayload.audio_path = params.audioFileName;

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
 * ADMIN: Delete a song from a library.
 * // TODO: Enforce server-side (RLS) security check - Admin only
 */
export async function deleteSong(
  songId: string
): Promise<{ success: boolean; error?: string }> {
  if (songLibraryConfig.isMockMode) {
    const songs = getStoredSongs();
    saveStoredSongs(songs.filter((s) => s.id !== songId));
    return { success: true };
  }

  try {
    const { error } = await (supabase as any).from("songs").delete().eq("id", songId);
    if (error) return { success: false, error: error.message };
    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to delete song on Supabase.",
    };
  }
}

/**
 * CLIENT: Save client song selections.
 * // TODO: Enforce server-side (RLS) security check - Client can only write own selections
 */
export async function saveClientSelections(
  selections: Array<{ songId: string; eventGroup: WeddingEventGroup }>
): Promise<{ success: boolean; error?: string }> {
  if (songLibraryConfig.isMockMode) {
    return { success: true };
  }

  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { success: false, error: "Not authenticated as client." };
    }

    // Delete existing selections
    await (supabase as any)
      .from("client_song_selections")
      .delete()
      .eq("client_id", user.id);

    // Insert new selections
    if (selections.length > 0) {
      const rows = selections.map((s) => ({
        client_id: user.id,
        song_id: s.songId,
        event_group: s.eventGroup,
      }));

      const { error } = await (supabase as any).from("client_song_selections").insert(rows);
      if (error) return { success: false, error: error.message };
    }

    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to save song selections.",
    };
  }
}

/**
 * CLIENT: Load client song selections.
 * // TODO: Enforce server-side (RLS) security check - Client can read own selections, Admin can read all
 */
export async function getClientSelections(
  clientId: string
): Promise<Array<{ id: string; clientId: string; songId: string; eventGroup: WeddingEventGroup }>> {
  if (songLibraryConfig.isMockMode) {
    return [];
  }

  try {
    const { data, error } = await (supabase as any)
      .from("client_song_selections")
      .select("*")
      .eq("client_id", clientId);

    if (error) throw error;

    return (data || []).map((row: any) => ({
      id: row.id,
      clientId: row.client_id,
      songId: row.song_id,
      eventGroup: row.event_group as WeddingEventGroup,
    }));
  } catch (err) {
    console.error("Failed to load client selections from Supabase:", err);
    return [];
  }
}
