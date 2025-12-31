/**
 * yt-most-replayed
 *
 * A TypeScript library to fetch YouTube's "Most Replayed" heatmap data.
 *
 * @example
 * ```typescript
 * import { getMostReplayed } from "yt-most-replayed";
 *
 * const data = await getMostReplayed("dQw4w9WgXcQ");
 *
 * if (data) {
 *   console.log(`Video has ${data.markers.length} heatmap segments`);
 *   console.log(`Peak moment at ${data.peakSegment?.startMillis}ms`);
 *   console.log(`Average intensity: ${data.averageIntensity.toFixed(2)}`);
 * } else {
 *   console.log("No most replayed data available for this video");
 * }
 * ```
 *
 * @packageDocumentation
 */

// Re-export main API
export { extractVideoId, getMostReplayed, isValidVideoId } from "./client.js";
// Re-export types
export type {
  FetchOptions,
  HeatmapMarker,
  MostReplayedData,
  TimedMarkerDecoration,
} from "./types.js";
export { MostReplayedError, MostReplayedErrorCode } from "./types.js";

// Re-export utility functions
export {
  filterByIntensity,
  formatTime,
  generateTimestampUrl,
  getSegmentAtTime,
  getSegmentDuration,
  getTopSegments,
} from "./utils.js";
