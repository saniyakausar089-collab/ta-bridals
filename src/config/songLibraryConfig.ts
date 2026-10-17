/**
 * TA Bridals - Song Library Configuration
 * Central configuration file for all server addresses, media storage, and feature settings.
 * All settings that may change when deployed to the client's own server must live here,
 * never hardcoded into UI screens or components.
 */

export interface SongLibraryConfig {
  /**
   * When true, uses in-memory mock data and local browser preview.
   * Switch to false when connecting to the client's custom backend server.
   */
  isMockMode: boolean;

  /**
   * Base URL for the client's custom API server.
   * e.g. "https://api.clientserver.com" or "http://localhost:4000"
   */
  apiBaseUrl: string;

  /**
   * Base URL for private audio storage on the client's server.
   * Audio files are never publicly exposed; playback uses short-lived tokens.
   */
  audioStorageBaseUrl: string;

  /**
   * Time in seconds before protected audio streaming tokens expire.
   */
  playbackTokenExpirySeconds: number;

  /**
   * Maximum allowed audio file upload size in megabytes.
   */
  maxUploadSizeMb: number;

  /**
   * Supported audio formats for uploads.
   */
  supportedAudioTypes: string[];
}

export const songLibraryConfig: SongLibraryConfig = {
  // Currently running in mock mode. Will be swapped to false on the client's server.
  isMockMode: true,

  // TODO: Replace with the client's custom server URL upon backend deployment
  apiBaseUrl: "https://api.tabridals.internal",

  // TODO: Replace with the client's custom media storage endpoint
  audioStorageBaseUrl: "https://media.tabridals.internal/songs",

  playbackTokenExpirySeconds: 3600, // 1 hour token validity
  maxUploadSizeMb: 50, // 50MB per song file
  supportedAudioTypes: ["audio/mpeg", "audio/mp3", "audio/wav", "audio/aac", "audio/m4a"],
};
