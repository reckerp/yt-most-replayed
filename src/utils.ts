import type { HeatmapMarker, MostReplayedData } from "./types.js";

/**
 * Converts milliseconds to a formatted time string (HH:MM:SS or MM:SS).
 *
 * @param millis - Time in milliseconds
 * @returns Formatted time string
 */
export function formatTime(millis: number): string {
  const totalSeconds = Math.floor(millis / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
  }
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

/**
 * Finds the top N most replayed segments.
 *
 * @param data - The most replayed data
 * @param count - Number of top segments to return (default: 5)
 * @returns Array of the most replayed segments, sorted by intensity descending
 */
export function getTopSegments(data: MostReplayedData, count: number = 5): HeatmapMarker[] {
  return [...data.markers]
    .sort((a, b) => b.intensityScoreNormalized - a.intensityScoreNormalized)
    .slice(0, count);
}

/**
 * Gets the segment at a specific time.
 *
 * @param data - The most replayed data
 * @param timeMillis - Time in milliseconds
 * @returns The segment at the given time, or null if not found
 */
export function getSegmentAtTime(data: MostReplayedData, timeMillis: number): HeatmapMarker | null {
  if (data.markers.length === 0) {
    return null;
  }

  // Find the segment that contains this time
  for (let i = data.markers.length - 1; i >= 0; i--) {
    const marker = data.markers[i]!;
    if (marker.startMillis <= timeMillis) {
      return marker;
    }
  }

  return null;
}

/**
 * Calculates the segment duration based on markers.
 *
 * @param data - The most replayed data
 * @returns Approximate segment duration in milliseconds
 */
export function getSegmentDuration(data: MostReplayedData): number {
  if (data.markers.length === 0) {
    return 0;
  }
  return data.markers[0]!.durationMillis;
}

/**
 * Generates a YouTube URL with timestamp.
 *
 * @param videoId - The YouTube video ID
 * @param timeMillis - Time in milliseconds
 * @returns Full YouTube URL with timestamp
 */
export function generateTimestampUrl(videoId: string, timeMillis: number): string {
  const seconds = Math.floor(timeMillis / 1000);
  return `https://www.youtube.com/watch?v=${videoId}&t=${seconds}`;
}

/**
 * Filters segments by intensity threshold.
 *
 * @param data - The most replayed data
 * @param threshold - Minimum intensity threshold (0-1)
 * @returns Segments with intensity at or above the threshold
 */
export function filterByIntensity(data: MostReplayedData, threshold: number): HeatmapMarker[] {
  return data.markers.filter((marker) => marker.intensityScoreNormalized >= threshold);
}
