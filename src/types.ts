export interface HeatmapMarker {
  startMillis: number;
  durationMillis: number;
  intensityScoreNormalized: number;
}

/**
 * Represents a timed marker decoration (chapter/highlight point).
 */
export interface TimedMarkerDecoration {
  /** Start time in milliseconds */
  visibleTimeRangeStartMillis: number;
  /** End time in milliseconds */
  visibleTimeRangeEndMillis: number;
}

/**
 * The complete most replayed data for a YouTube video.
 */
export interface MostReplayedData {
  /** Array of heatmap markers representing replay intensity over time */
  markers: HeatmapMarker[];
  /** Optional timed marker decorations */
  timedMarkerDecorations: TimedMarkerDecoration[] | null;
  /** Video duration in milliseconds (derived from markers) */
  videoDurationMillis: number;
  /** The peak replay segment (highest intensity) */
  peakSegment: HeatmapMarker | null;
  /** Average intensity across all segments */
  averageIntensity: number;
}

export interface FetchOptions {
  fetch?: typeof globalThis.fetch;
  timeout?: number;
  userAgent?: string;
  retries?: number;
  retryDelay?: number;
}

/**
 * Options for batch fetching multiple videos.
 */
export interface BatchFetchOptions extends FetchOptions {
  /** Maximum number of concurrent requests (default: 5) */
  concurrency?: number;
}

/**
 * Result of a batch fetch operation for a single video.
 */
export interface BatchResult {
  /** The video ID */
  videoId: string;
  /** The most replayed data, or null if not available */
  data: MostReplayedData | null;
  /** Error if the fetch failed */
  error?: MostReplayedError;
}

/**
 * Error codes for the library.
 */
export enum MostReplayedErrorCode {
  /** The video ID format is invalid */
  INVALID_VIDEO_ID = "INVALID_VIDEO_ID",
  /** Failed to fetch the video page */
  FETCH_FAILED = "FETCH_FAILED",
  /** Could not parse YouTube's initial data */
  PARSE_FAILED = "PARSE_FAILED",
  /** No most replayed data available for this video */
  NO_DATA_AVAILABLE = "NO_DATA_AVAILABLE",
  /** Request timed out */
  TIMEOUT = "TIMEOUT",
}

/**
 * Custom error class for the library.
 */
export class MostReplayedError extends Error {
  public readonly code: MostReplayedErrorCode;
  public override readonly cause?: Error;

  constructor(code: MostReplayedErrorCode, message: string, cause?: Error) {
    super(message);
    this.code = code;
    this.cause = cause;
    this.name = "MostReplayedError";
    Object.setPrototypeOf(this, MostReplayedError.prototype);
  }
}
