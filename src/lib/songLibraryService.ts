/**
 * TA Bridals - Song Library Service Layer
 *
 * All client authentication, client profile management, song libraries,
 * audio playback streaming, song selections, and submission notifications are
 * encapsulated behind this service layer.
 *
 * NO direct cloud database queries or migrations are performed here.
 * When the app is deployed to the client's own backend server, this service layer
 * will connect to the client's custom API without altering any UI screens.
 */

import { songLibraryConfig } from "@/config/songLibraryConfig";
import type {
  ClientProfile,
  ClientApprovalStatus,
  SongItem,
  SongLibraryRecord,
  ClientSongSelection,
  ClientSubmissionNotification,
  WeddingEventGroup,
} from "@/types/songLibrary";

// Storage keys for mock session (passwords are NEVER stored)
const CLIENT_SESSION_KEY = "ta_bridals_mock_client_session";
const CLIENT_PROFILES_STORAGE_KEY = "ta_bridals_mock_client_profiles";
const CLIENT_SELECTIONS_STORAGE_KEY = "ta_bridals_mock_client_selections";
const NOTIFICATIONS_STORAGE_KEY = "ta_bridals_mock_notifications";

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
      rejectionReason: "Incomplete booking details. Please verify your contract with the studio manager.",
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
    description: "Traditional shehnai, classical fusion, and grand entrance anthems for royal palace weddings.",
    songCount: 18,
    clientCount: 4,
    createdAt: "2026-10-01T08:00:00.000Z",
    updatedAt: "2026-10-15T12:00:00.000Z",
  },
  {
    id: "lib-contemporary-beats",
    name: "Modern & Contemporary Beats",
    description: "High-energy sangeet mashups, cocktail house remixes, and intimate acoustic couple dance tracks.",
    songCount: 22,
    clientCount: 6,
    createdAt: "2026-10-03T10:00:00.000Z",
    updatedAt: "2026-10-16T15:00:00.000Z",
  },
  {
    id: "lib-sufi-spiritual",
    name: "Sufi & Soulful Melodies",
    description: "Deep, soulful devotional acoustic tracks ideal for Nikah, Pheras, and heartfelt Vidaai.",
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

// Helper: load stored profiles from localStorage
function getStoredProfiles(): ClientProfile[] {
  if (typeof window === "undefined") return DEMO_CLIENT_ACCOUNTS.map((a) => a.profile);
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

/**
 * CLIENT AUTH: Get the currently active client session.
 * TODO: Enforce server-side security check (user auth & permissions) when connected to client server.
 */
export function getClientSession(): ClientProfile | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(CLIENT_SESSION_KEY);
    if (!raw) return null;
    const session = JSON.parse(raw) as ClientProfile;
    // Always refresh approval status from latest stored profiles
    const all = getStoredProfiles();
    const updated = all.find((p) => p.id === session.id);
    const current = updated ? { ...updated } : { ...session };
    if (current.assignedLibraryId) {
      const libs = getStoredLibraries();
      const matchedLib = libs.find((l) => l.id === current.assignedLibraryId);
      if (matchedLib) {
        current.assignedLibraryName = matchedLib.name;
      }
    }
    return current;
  } catch {
    return null;
  }
}

/**
 * CLIENT AUTH: Client Login
 * TODO: Enforce server-side security check (user auth & permissions) when connected to client server.
 */
export async function clientLogin(
  email: string,
  password: string
): Promise<{ success: boolean; client: ClientProfile | null; error?: string }> {
  const normalizedEmail = email.trim().toLowerCase();

  // Basic validation
  if (!normalizedEmail || !normalizedEmail.includes("@")) {
    return { success: false, client: null, error: "Please enter a valid email address." };
  }
  if (!password) {
    return { success: false, client: null, error: "Please enter your password." };
  }

  // In mock mode, match against registered profiles
  const profiles = getStoredProfiles();
  const matched = profiles.find((p) => p.email.toLowerCase() === normalizedEmail);

  if (!matched) {
    return {
      success: false,
      client: null,
      error: "No client account found with this email. Please check your email or sign up.",
    };
  }

  // In mock mode, any password of at least 6 characters is accepted for demo convenience
  if (password.length < 6) {
    return { success: false, client: null, error: "Password must be at least 6 characters." };
  }

  // Save session (NO password is stored)
  if (typeof window !== "undefined") {
    sessionStorage.setItem(CLIENT_SESSION_KEY, JSON.stringify(matched));
  }

  return { success: true, client: matched };
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
 * Passwords are NEVER stored in the browser.
 * TODO: Enforce server-side security check (user auth & permissions) when connected to client server.
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

  const existingProfiles = getStoredProfiles();
  const duplicate = existingProfiles.find((p) => p.email.toLowerCase() === trimmedEmail);
  if (duplicate) {
    return {
      success: false,
      client: null,
      error: "An account with this email address already exists. Please sign in instead.",
    };
  }

  // Create new client profile strictly with status 'pending'
  const newClient: ClientProfile = {
    id: `client-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    fullName: trimmedName,
    partnerName: partnerName?.trim() || undefined,
    email: trimmedEmail,
    phone: phone?.trim() || undefined,
    weddingDate: weddingDate || undefined,
    approvalStatus: "pending", // ALWAYS starts as pending
    assignedLibraryId: null,
    createdAt: new Date().toISOString(),
    reviewedAt: null,
    reviewedBy: null,
  };

  const updated = [newClient, ...existingProfiles];
  saveStoredProfiles(updated);

  // Set active session in browser
  if (typeof window !== "undefined") {
    sessionStorage.setItem(CLIENT_SESSION_KEY, JSON.stringify(newClient));
  }

  return { success: true, client: newClient };
}

/**
 * CLIENT AUTH: Sign Out
 * Clears client session and sends client to client login.
 */
export function clientSignOut(): void {
  if (typeof window !== "undefined") {
    sessionStorage.removeItem(CLIENT_SESSION_KEY);
  }
}

/**
 * CLIENT AUTH: Re-check current client approval status from storage.
 * TODO: Enforce server-side security check (user auth & permissions) when connected to client server.
 */
export async function refreshClientStatus(clientId: string): Promise<ClientApprovalStatus> {
  const profiles = getStoredProfiles();
  const client = profiles.find((p) => p.id === clientId);
  return client?.approvalStatus || "pending";
}

/**
 * AUDIO PLAYBACK: Return protected, short-lived streaming URL.
 * Song audio must not be publicly accessible.
 * TODO: Enforce server-side security check (user auth & permissions) when connected to client server.
 * When on the client's own server, this will request a short-lived signed URL or token.
 */
export function getSongPlaybackUrl(songId: string): string {
  // In mock mode, return an open-source preview audio stream for playback testing
  // Audio courtesy of royalty-free creative commons audio samples
  return "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3";
}

const LIBRARIES_STORAGE_KEY = "ta_bridals_mock_libraries";
const SONGS_STORAGE_KEY = "ta_bridals_mock_songs";

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
 * ADMIN: Get all clients with their assigned library names.
 * // TODO: Enforce server-side (RLS) security check - Admin only
 */
export async function getClients(): Promise<ClientProfile[]> {
  const profiles = getStoredProfiles();
  const libraries = getStoredLibraries();
  const libMap = new Map(libraries.map((l) => [l.id, l.name]));

  return profiles.map((p) => ({
    ...p,
    assignedLibraryName: p.assignedLibraryId ? libMap.get(p.assignedLibraryId) : undefined,
  }));
}

/**
 * ADMIN: Approve a pending client and optionally assign a song library.
 * If the action fails, an explicit error is returned. Never silently fall back.
 * // TODO: Enforce server-side (RLS) security check - Admin only
 */
export async function approveClient(
  clientId: string,
  libraryId?: string
): Promise<{ success: boolean; client?: ClientProfile; error?: string }> {
  const profiles = getStoredProfiles();
  const index = profiles.findIndex((p) => p.id === clientId);

  if (index === -1) {
    return {
      success: false,
      error: `Client with ID "${clientId}" was not found. Cannot approve.`,
    };
  }

  const libraries = getStoredLibraries();
  if (libraryId && !libraries.some((l) => l.id === libraryId)) {
    return {
      success: false,
      error: `Library with ID "${libraryId}" does not exist. Cannot assign invalid library.`,
    };
  }

  const updatedClient: ClientProfile = {
    ...profiles[index],
    approvalStatus: "approved",
    rejectionReason: undefined, // Clear any previous rejection reason
    assignedLibraryId: libraryId !== undefined ? libraryId : profiles[index].assignedLibraryId,
    reviewedAt: new Date().toISOString(),
    reviewedBy: "Studio Owner",
  };

  profiles[index] = updatedClient;
  saveStoredProfiles(profiles);

  return { success: true, client: updatedClient };
}

/**
 * ADMIN: Reject a client registration with an optional reason.
 * If the action fails, an explicit error is returned. Never silently fall back.
 * // TODO: Enforce server-side (RLS) security check - Admin only
 */
export async function rejectClient(
  clientId: string,
  reason?: string
): Promise<{ success: boolean; client?: ClientProfile; error?: string }> {
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

/**
 * ADMIN: Fetch all song libraries.
 * Updates dynamic client and song counts.
 * // TODO: Enforce server-side (RLS) security check - Authenticated users only
 */
export async function getSongLibraries(includeArchived = false): Promise<SongLibraryRecord[]> {
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

/**
 * ADMIN: Create a new song library.
 * If name is empty or duplicate, an explicit error is returned.
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

  const updated = [newLibrary, ...libraries];
  saveStoredLibraries(updated);

  return { success: true, library: newLibrary };
}

/**
 * ADMIN: Edit an existing song library.
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

  const libraries = getStoredLibraries();
  const index = libraries.findIndex((l) => l.id === libraryId);
  if (index === -1) {
    return { success: false, error: `Library with ID "${libraryId}" does not exist.` };
  }

  const duplicate = libraries.find(
    (l) => l.id !== libraryId && l.name.toLowerCase() === trimmedName.toLowerCase()
  );
  if (duplicate) {
    return {
      success: false,
      error: `Another library named "${trimmedName}" already exists.`,
    };
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

/**
 * ADMIN: Archive or unarchive a song library.
 * // TODO: Enforce server-side (RLS) security check - Admin only
 */
export async function archiveSongLibrary(
  libraryId: string,
  isArchived: boolean
): Promise<{ success: boolean; error?: string }> {
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

/**
 * ADMIN: Assign an approved client to a song library.
 * Only APPROVED clients can be assigned. If unapproved, returns explicit error.
 * // TODO: Enforce server-side (RLS) security check - Admin only
 */
export async function assignClientToLibrary(
  clientId: string,
  libraryId: string
): Promise<{ success: boolean; client?: ClientProfile; error?: string }> {
  const profiles = getStoredProfiles();
  const clientIndex = profiles.findIndex((p) => p.id === clientId);

  if (clientIndex === -1) {
    return { success: false, error: `Client with ID "${clientId}" was not found.` };
  }

  // Strict check: Only approved clients can be assigned
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
  };

  profiles[clientIndex] = updatedClient;
  saveStoredProfiles(profiles);

  return { success: true, client: updatedClient };
}

/**
 * ADMIN: Delete a song library.
 * Prevents deleting if clients are currently assigned.
 * // TODO: Enforce server-side (RLS) security check - Admin only
 */
export async function deleteSongLibrary(
  libraryId: string
): Promise<{ success: boolean; error?: string }> {
  const profiles = getStoredProfiles();
  const assigned = profiles.filter((p) => p.assignedLibraryId === libraryId);

  if (assigned.length > 0) {
    return {
      success: false,
      error: `Cannot delete library. There are ${assigned.length} client(s) currently assigned to this library. Please reassign them first.`,
    };
  }

  const libraries = getStoredLibraries();
  const filtered = libraries.filter((l) => l.id !== libraryId);
  saveStoredLibraries(filtered);

  // Also remove all songs belonging to this library
  const songs = getStoredSongs();
  const filteredSongs = songs.filter((s) => s.libraryId !== libraryId);
  saveStoredSongs(filteredSongs);

  return { success: true };
}

/**
 * SONGS: Get songs for a library, grouped or filtered by event category.
 * // TODO: Enforce server-side (RLS) security check - User must be assigned client or Admin
 */
export async function getSongsByLibrary(libraryId: string): Promise<SongItem[]> {
  const songs = getStoredSongs();
  return songs.filter((s) => s.libraryId === libraryId);
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

  const libraries = getStoredLibraries();
  if (!libraries.some((l) => l.id === params.libraryId)) {
    return { success: false, error: `Library with ID "${params.libraryId}" does not exist.` };
  }

  const durationSec = params.durationSeconds || 210;
  const mins = Math.floor(durationSec / 60);
  const secs = durationSec % 60;
  const durationFormatted = `${mins}:${secs < 10 ? "0" : ""}${secs}`;

  const newSong: SongItem = {
    id: `song-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    title,
    artist,
    eventGroup: params.eventGroup,
    durationSeconds: durationSec,
    durationFormatted,
    libraryId: params.libraryId,
    audioFileName: params.audioFileName || undefined,
    playbackUrl: getSongPlaybackUrl(`song-${Date.now()}`),
    tags: params.tags || [params.eventGroup],
    createdAt: new Date().toISOString(),
  };

  const songs = getStoredSongs();
  const updatedSongs = [newSong, ...songs];
  saveStoredSongs(updatedSongs);

  return { success: true, song: newSong };
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
    tags?: string[];
  }
): Promise<{ success: boolean; song?: SongItem; error?: string }> {
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
    tags: params.tags || current.tags,
  };

  songs[index] = updatedSong;
  saveStoredSongs(songs);

  return { success: true, song: updatedSong };
}

/**
 * ADMIN: Delete a song from a library.
 * // TODO: Enforce server-side (RLS) security check - Admin only
 */
export async function deleteSong(
  songId: string
): Promise<{ success: boolean; error?: string }> {
  const songs = getStoredSongs();
  const filtered = songs.filter((s) => s.id !== songId);
  saveStoredSongs(filtered);

  return { success: true };
}
