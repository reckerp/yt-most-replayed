/**
 * Represents a single heatmap marker point in the most replayed data.
 * Each marker indicates the relative intensity of replays at a specific time.
 */
export interface HeatmapMarker {
  /** Start time of this marker segment in milliseconds */
  startMillis: number;
  /** Intensity score (0-1) indicating how frequently this segment is replayed */
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

/**
 * Options for fetching most replayed data.
 */
export interface FetchOptions {
  /** Custom fetch function (useful for testing or custom HTTP clients) */
  fetch?: typeof globalThis.fetch;
  /** Request timeout in milliseconds (default: 10000) */
  timeout?: number;
  /** Custom user agent string */
  userAgent?: string;
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
