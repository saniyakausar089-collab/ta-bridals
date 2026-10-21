/**
 * TA Bridals - Song Library Domain Types
 */

export const WEDDING_EVENT_GROUPS = [
  "Bride Entry",
  "Groom Entry",
  "Couple Entry",
  "Haldi",
  "Mehendi",
  "Sangeet",
  "Wedding Ceremony",
  "Varmala/Jaimala",
  "Pheras",
  "Reception",
  "First Dance",
  "Couple Portraits",
  "Family Moments",
  "Emotional/Romantic Moments",
  "Grand Finale",
  "Custom Event",
] as const;

export type WeddingEventGroup = (typeof WEDDING_EVENT_GROUPS)[number];

export type ClientApprovalStatus = "pending" | "approved" | "rejected";

export interface ClientProfile {
  id: string;
  fullName: string;
  partnerName?: string | undefined;
  email: string;
  phone?: string | undefined;
  weddingDate?: string | undefined;
  approvalStatus: ClientApprovalStatus;
  rejectionReason?: string | undefined;
  assignedLibraryId: string | null;
  assignedLibraryName?: string | undefined;
  assignedLibraryIds?: string[] | undefined;
  assignedLibraryNames?: string[] | undefined;
  createdAt: string;
  reviewedAt?: string | null | undefined;
  reviewedBy?: string | null | undefined;
}

export interface SongItem {
  id: string;
  title: string;
  artist: string;
  eventGroup: WeddingEventGroup;
  durationSeconds: number;
  durationFormatted: string;
  libraryId: string;
  playbackUrl?: string | undefined;
  audioFileName?: string | undefined;
  youtubeVideoId?: string | undefined;
  channelName?: string | undefined;
  thumbnailUrl?: string | undefined;
  youtubeUrl?: string | undefined;
  isActive?: boolean | undefined;
  tags?: string[] | undefined;
  createdAt: string;
}

export interface SongLibraryRecord {
  id: string;
  name: string;
  description: string;
  isArchived?: boolean | undefined;
  songCount: number;
  clientCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface ClientCustomSongRequest {
  id: string;
  songTitle: string;
  artistOrDetails?: string | undefined;
  eventGroup: WeddingEventGroup;
  notes?: string | undefined;
  youtubeUrl?: string | undefined;
  createdAt: string;
}

export interface ClientSongSelection {
  id: string;
  clientId: string;
  libraryId: string;
  selectedSongIds: string[];
  customRequests?: ClientCustomSongRequest[] | undefined;
  notes?: string | undefined;
  status: "draft" | "submitted" | "locked";
  submittedAt?: string | undefined;
  updatedAt: string;
}

export interface ClientSubmissionNotification {
  id: string;
  clientId: string;
  clientName: string;
  clientEmail: string;
  songCount: number;
  notes?: string | undefined;
  isRead: boolean;
  createdAt: string;
}
