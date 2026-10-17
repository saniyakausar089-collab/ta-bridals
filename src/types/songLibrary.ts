/**
 * TA Bridals - Song Library Domain Types
 */

export const WEDDING_EVENT_GROUPS = [
  "Haldi",
  "Mehendi",
  "Sangeet",
  "Baraat",
  "Entry",
  "Nikah",
  "Pheras/Ceremony",
  "Couple Dance",
  "Cocktail",
  "Reception",
  "Vidaai",
  "Other",
] as const;

export type WeddingEventGroup = (typeof WEDDING_EVENT_GROUPS)[number];

export type ClientApprovalStatus = "pending" | "approved" | "rejected";

export interface ClientProfile {
  id: string;
  fullName: string;
  partnerName?: string;
  email: string;
  phone?: string;
  weddingDate?: string;
  approvalStatus: ClientApprovalStatus;
  assignedLibraryId: string | null;
  assignedLibraryName?: string;
  createdAt: string;
  reviewedAt?: string | null;
  reviewedBy?: string | null;
}

export interface SongItem {
  id: string;
  title: string;
  artist: string;
  eventGroup: WeddingEventGroup;
  durationSeconds: number;
  durationFormatted: string;
  libraryId: string;
  playbackUrl?: string;
  tags?: string[];
  createdAt: string;
}

export interface SongLibraryRecord {
  id: string;
  name: string;
  description: string;
  songCount: number;
  clientCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface ClientSongSelection {
  id: string;
  clientId: string;
  libraryId: string;
  selectedSongIds: string[];
  notes?: string;
  status: "draft" | "submitted" | "locked";
  submittedAt?: string;
  updatedAt: string;
}

export interface ClientSubmissionNotification {
  id: string;
  clientId: string;
  clientName: string;
  clientEmail: string;
  songCount: number;
  notes?: string;
  isRead: boolean;
  createdAt: string;
}
