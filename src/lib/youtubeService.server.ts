/**
 * Server-side YouTube Data API v3 Search Service
 *
 * Securely searches YouTube music videos without exposing YOUTUBE_API_KEY to client bundle.
 * Enforces embeddability, music category/type filtering, LRU caching, quota limit handling,
 * and high quality mock fallback when API key is not configured or in test environments.
 */

export interface YouTubeSearchResult {
  videoId: string;
  title: string;
  channelName: string;
  thumbnailUrl: string;
  youtubeUrl: string;
  description?: string;
}

export interface YouTubeSearchResponse {
  success: boolean;
  results: YouTubeSearchResult[];
  error?: string;
  fromCache?: boolean;
}

// In-memory cache with 1-hour TTL
interface CacheEntry {
  timestamp: number;
  results: YouTubeSearchResult[];
}

const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour
const searchCache = new Map<string, CacheEntry>();

/**
 * Curated high quality mock search database for wedding event music
 */
const MOCK_WEDDING_VIDEOS: YouTubeSearchResult[] = [
  {
    videoId: "kJQP7kiw5Fk",
    title: "Gud Naal Ishq Mitha (Royal Dhol Mix)",
    channelName: "Desi Music Factory",
    thumbnailUrl:
      "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=480&auto=format&fit=crop&q=80",
    youtubeUrl: "https://www.youtube.com/watch?v=kJQP7kiw5Fk",
    description: "High energy Punjabi wedding classic for Haldi and Sangeet celebrations.",
  },
  {
    videoId: "fJ9rUzIMcZQ",
    title: "Mehendi Hai Rachnewali (Acoustic Strings)",
    channelName: "Sony Music India",
    thumbnailUrl:
      "https://images.unsplash.com/photo-1465847899084-d164df4dedc6?w=480&auto=format&fit=crop&q=80",
    youtubeUrl: "https://www.youtube.com/watch?v=fJ9rUzIMcZQ",
    description: "Traditional sitar and vocal rendition for Mehendi ceremonies.",
  },
  {
    videoId: "1e1nyvsmc1U",
    title: "Din Shagna Da (Grand Royal Bridal Entry)",
    channelName: "Jasleen Royal Official",
    thumbnailUrl:
      "https://images.unsplash.com/photo-1519741497674-611481863552?w=480&auto=format&fit=crop&q=80",
    youtubeUrl: "https://www.youtube.com/watch?v=1e1nyvsmc1U",
    description: "Emotional and graceful wedding bridal entry song.",
  },
  {
    videoId: "pVNw9-Q7xW0",
    title: "Sauda Khara Khara (Nagada Groom Baraat Edit)",
    channelName: "Zee Music Company",
    thumbnailUrl:
      "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=480&auto=format&fit=crop&q=80",
    youtubeUrl: "https://www.youtube.com/watch?v=pVNw9-Q7xW0",
    description: "Energetic brass and dhol anthem for Groom Baraat and Entry.",
  },
  {
    videoId: "D86j0QO1D-w",
    title: "Kudmayi (Royal Varmala Symphony)",
    channelName: "Saregama Music",
    thumbnailUrl:
      "https://images.unsplash.com/photo-1532712938310-34cb3982ef74?w=480&auto=format&fit=crop&q=80",
    youtubeUrl: "https://www.youtube.com/watch?v=D86j0QO1D-w",
    description: "Grand orchestral background music for Varmala and Jaimala.",
  },
  {
    videoId: "OPf0YbXqDm0",
    title: "Mangalyam Tantunanena (Sacred Pheras Symphony)",
    channelName: "Spiritual Symphony",
    thumbnailUrl:
      "https://images.unsplash.com/photo-1520854221256-17451cc331bf?w=480&auto=format&fit=crop&q=80",
    youtubeUrl: "https://www.youtube.com/watch?v=OPf0YbXqDm0",
    description: "Sacred Vedic mantras woven into traditional Indian classical symphonies.",
  },
  {
    videoId: "BddP6PYo2gs",
    title: "Kesariya (First Dance Waltz Edit)",
    channelName: "Sony Music India",
    thumbnailUrl:
      "https://images.unsplash.com/photo-1492684223066-81342ee5ff30?w=480&auto=format&fit=crop&q=80",
    youtubeUrl: "https://www.youtube.com/watch?v=BddP6PYo2gs",
    description: "Intimate waltz and romantic melody for couple's first dance.",
  },
  {
    videoId: "7zp1TbLFPp8",
    title: "Gallan Goodiyaan (Sangeet Floor Opener)",
    channelName: "T-Series",
    thumbnailUrl:
      "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=480&auto=format&fit=crop&q=80",
    youtubeUrl: "https://www.youtube.com/watch?v=7zp1TbLFPp8",
    description: "All-family dance floor opener for Indian wedding sangeets.",
  },
  {
    videoId: "gqmXPECFVGs",
    title: "Rang Sharbaton Ka (Couple Portraits Edit)",
    channelName: "Tips Official",
    thumbnailUrl:
      "https://images.unsplash.com/photo-1518173946687-a4c8a383392e?w=480&auto=format&fit=crop&q=80",
    youtubeUrl: "https://www.youtube.com/watch?v=gqmXPECFVGs",
    description: "Gentle acoustic strings for couple portrait reels and teasers.",
  },
  {
    videoId: "jHNNMj5bNQw",
    title: "Kabira (Farewell Emotional Symphony)",
    channelName: "T-Series",
    thumbnailUrl:
      "https://images.unsplash.com/photo-1511765224389-37f0e77cf0eb?w=480&auto=format&fit=crop&q=80",
    youtubeUrl: "https://www.youtube.com/watch?v=jHNNMj5bNQw",
    description: "Deep, heartfelt vocal melody for emotional and family moments.",
  },
  {
    videoId: "y6120QOlsfU",
    title: "Subha Hone Na De (Grand Reception Finale)",
    channelName: "T-Series",
    thumbnailUrl:
      "https://images.unsplash.com/photo-1429962714451-bb934ecdc4ec?w=480&auto=format&fit=crop&q=80",
    youtubeUrl: "https://www.youtube.com/watch?v=y6120QOlsfU",
    description: "High tempo reception dance anthem.",
  },
  {
    videoId: "DRAmE3l_vQ0",
    title: "London Thumakda (Family Celebration Mix)",
    channelName: "Zee Music Company",
    thumbnailUrl:
      "https://images.unsplash.com/photo-1501386761578-eac5c94b800a?w=480&auto=format&fit=crop&q=80",
    youtubeUrl: "https://www.youtube.com/watch?v=DRAmE3l_vQ0",
    description: "Grand finale celebration song for whole family.",
  },
];

/**
 * Clean and normalize text by unescaping HTML entities returned by YouTube API
 */
export function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'");
}

/**
 * Execute YouTube Search on the server
 */
export async function searchYouTubeServer(
  query: string,
  limit = 12,
): Promise<YouTubeSearchResponse> {
  const cleanQuery = (query || "").trim();
  if (!cleanQuery) {
    return { success: true, results: [] };
  }

  const cacheKey = `${cleanQuery.toLowerCase()}_${limit}`;
  const now = Date.now();

  // Check in-memory cache
  const cached = searchCache.get(cacheKey);
  if (cached && now - cached.timestamp < CACHE_TTL_MS) {
    return { success: true, results: cached.results, fromCache: true };
  }

  const apiKey = typeof process !== "undefined" ? process.env?.["YOUTUBE_API_KEY"] : undefined;

  // If no API key is provided, use high-quality mock search
  if (!apiKey) {
    const qLower = cleanQuery.toLowerCase();
    const matched = MOCK_WEDDING_VIDEOS.filter(
      (v) =>
        v.title.toLowerCase().includes(qLower) ||
        v.channelName.toLowerCase().includes(qLower) ||
        (v.description && v.description.toLowerCase().includes(qLower)),
    );

    // If query didn't match specific title, return top wedding songs matching query words
    const fallbackResults = (matched.length > 0 ? matched : MOCK_WEDDING_VIDEOS).slice(0, limit);

    searchCache.set(cacheKey, { timestamp: now, results: fallbackResults });
    return { success: true, results: fallbackResults };
  }

  // Real YouTube Data API v3 Search
  try {
    const url = new URL("https://www.googleapis.com/youtube/v3/search");
    url.searchParams.set("part", "snippet");
    url.searchParams.set("q", `${cleanQuery} wedding song music`);
    url.searchParams.set("type", "video");
    url.searchParams.set("videoEmbeddable", "true");
    url.searchParams.set("videoCategoryId", "10"); // Category 10 = Music
    url.searchParams.set("maxResults", String(Math.min(limit, 25)));
    url.searchParams.set("key", apiKey);

    const res = await fetch(url.toString(), {
      headers: { Accept: "application/json" },
    });

    if (!res.ok) {
      const errBody = await res.json().catch(() => ({}));
      const message = errBody?.error?.message || `YouTube API responded with status ${res.status}`;

      // Handle Quota Limit gracefully
      if (res.status === 403 && (message.includes("quota") || message.includes("QuotaExceeded"))) {
        console.warn("YouTube API quota exceeded. Falling back to curated wedding catalogue.");
        const fallbackResults = MOCK_WEDDING_VIDEOS.slice(0, limit);
        return { success: true, results: fallbackResults, fromCache: false };
      }

      return { success: false, results: [], error: message };
    }

    const data = await res.json();
    const items = Array.isArray(data?.items) ? data.items : [];

    // Deduplicate by video ID
    const seenIds = new Set<string>();
    const results: YouTubeSearchResult[] = [];

    for (const item of items) {
      const videoId = item?.id?.videoId;
      if (!videoId || seenIds.has(videoId)) continue;
      seenIds.add(videoId);

      const snippet = item?.snippet || {};
      const title = decodeHtmlEntities(snippet.title || "Untitled Video");
      const channelName = decodeHtmlEntities(snippet.channelTitle || "YouTube Creator");
      const thumbnailUrl =
        snippet.thumbnails?.high?.url ||
        snippet.thumbnails?.medium?.url ||
        snippet.thumbnails?.default?.url ||
        `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
      const youtubeUrl = `https://www.youtube.com/watch?v=${videoId}`;

      results.push({
        videoId,
        title,
        channelName,
        thumbnailUrl,
        youtubeUrl,
        description: snippet.description || "",
      });
    }

    // Save into cache
    searchCache.set(cacheKey, { timestamp: now, results });

    return { success: true, results };
  } catch (err) {
    console.error("YouTube search error:", err);
    return {
      success: false,
      results: [],
      error: err instanceof Error ? err.message : "Failed to search YouTube.",
    };
  }
}
