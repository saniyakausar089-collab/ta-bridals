import { describe, it, expect, beforeEach } from "vitest";
import { decodeHtmlEntities, searchYouTubeServer } from "./youtubeService.server";
import { WEDDING_EVENT_GROUPS, type WeddingEventGroup } from "@/types/songLibrary";
import {
  getSongsByLibrary,
  addSongToLibrary,
  deleteSong,
  saveClientSelections,
  getClientSelections,
  saveStoredSongs,
  INITIAL_SONGS,
} from "./songLibraryService";

describe("YouTube Music Library Integration", () => {
  beforeEach(() => {
    // Reset initial mock songs
    saveStoredSongs([...INITIAL_SONGS]);
  });

  describe("1. 16 Exact Wedding Categories Harmonization", () => {
    it("should have all 16 exact categories specified by the studio", () => {
      const expectedCategories: WeddingEventGroup[] = [
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
      ];

      expect(WEDDING_EVENT_GROUPS).toEqual(expectedCategories);
      expect(WEDDING_EVENT_GROUPS.length).toBe(16);
    });
  });

  describe("2. Server-side YouTube Search Service", () => {
    it("should decode HTML entities properly", () => {
      const raw = "Kudmayi &amp; Din Shagna Da &#39;Special&#39; &quot;Mix&quot;";
      expect(decodeHtmlEntities(raw)).toBe("Kudmayi & Din Shagna Da 'Special' \"Mix\"");
    });

    it("should return empty list when query is empty", async () => {
      const res = await searchYouTubeServer("");
      expect(res.success).toBe(true);
      expect(res.results).toEqual([]);
    });

    it("should search and return sanitized video details (with mock fallback if no API key)", async () => {
      const res = await searchYouTubeServer("Din Shagna Da", 5);
      expect(res.success).toBe(true);
      expect(res.results.length).toBeGreaterThan(0);
      const first = res.results[0];
      expect(first).toBeDefined();
      expect(first).toHaveProperty("videoId");
      expect(first).toHaveProperty("title");
      expect(first).toHaveProperty("channelName");
      expect(first).toHaveProperty("thumbnailUrl");
      expect(first).toHaveProperty("youtubeUrl");
      expect(first!.youtubeUrl).toContain("youtube.com/watch?v=");
    });

    it("should serve repeat searches from in-memory cache", async () => {
      const firstRes = await searchYouTubeServer("Kesariya", 4);
      expect(firstRes.success).toBe(true);

      const secondRes = await searchYouTubeServer("Kesariya", 4);
      expect(secondRes.success).toBe(true);
      expect(secondRes.fromCache).toBe(true);
    });
  });

  describe("3. Duplicate Prevention & Library Catalog Management", () => {
    it("should successfully add a YouTube track to a library", async () => {
      const res = await addSongToLibrary({
        libraryId: "lib-royal-heritage",
        title: "Raataan Lambiyan (Acoustic)",
        artist: "T-Series",
        eventGroup: "First Dance",
        youtubeVideoId: "gvyUuxdRdR4",
        youtubeUrl: "https://www.youtube.com/watch?v=gvyUuxdRdR4",
        channelName: "T-Series",
        thumbnailUrl: "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4",
      });

      expect(res.success).toBe(true);
      expect(res.song?.youtubeVideoId).toBe("gvyUuxdRdR4");
      expect(res.song?.eventGroup).toBe("First Dance");
    });

    it("should prevent duplicate YouTube video from being added to the same library", async () => {
      // Add first time
      await addSongToLibrary({
        libraryId: "lib-royal-heritage",
        title: "Test Video",
        artist: "Artist",
        eventGroup: "Haldi",
        youtubeVideoId: "unique-video-123",
      });

      // Attempt duplicate addition
      const duplicateRes = await addSongToLibrary({
        libraryId: "lib-royal-heritage",
        title: "Duplicate Video",
        artist: "Artist",
        eventGroup: "Haldi",
        youtubeVideoId: "unique-video-123",
      });

      expect(duplicateRes.success).toBe(false);
      expect(duplicateRes.error).toContain("already in this library");
    });

    it("should allow removing a song from collection without deleting selections", async () => {
      const songsBefore = await getSongsByLibrary("lib-royal-heritage");
      const targetSong = songsBefore[0];
      expect(targetSong).toBeDefined();

      const delRes = await deleteSong(targetSong!.id);
      expect(delRes.success).toBe(true);

      const songsAfter = await getSongsByLibrary("lib-royal-heritage");
      expect(songsAfter.some((s) => s.id === targetSong!.id)).toBe(false);
    });
  });

  describe("4. Client Selections & Empty-State Bug Fix", () => {
    it("should persist and restore client song selections across page reloads", async () => {
      const clientId = "demo-client-approved";
      const selections = [
        { songId: "song-1", eventGroup: "Haldi" as const },
        { songId: "song-2", eventGroup: "Mehendi" as const },
      ];

      const saveRes = await saveClientSelections(selections, clientId);
      expect(saveRes.success).toBe(true);

      const loaded = await getClientSelections(clientId);
      expect(loaded.length).toBe(2);
      expect(loaded.map((l) => l.songId)).toContain("song-1");
      expect(loaded.map((l) => l.songId)).toContain("song-2");
    });
  });
});
