import {
  calculateAverageIntensity,
  estimateVideoDuration,
  extractInitialDataJson,
  findMarkersListData,
  findPeakSegment,
  parseInitialData,
  transformMarkers,
  transformTimedMarkerDecorations,
} from "./parser.js";
import {
  type FetchOptions,
  type MostReplayedData,
  MostReplayedError,
  MostReplayedErrorCode,
} from "./types.js";

const DEFAULT_TIMEOUT = 10000;
const DEFAULT_USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

/**
 * Regular expression to validate YouTube video IDs.
 * Valid IDs are 11 characters containing alphanumeric, hyphens, and underscores.
 */
const VIDEO_ID_REGEX = /^[a-zA-Z0-9_-]{11}$/;

/**
 * Validates a YouTube video ID format.
 */
export function isValidVideoId(videoId: string): boolean {
  return VIDEO_ID_REGEX.test(videoId);
}

/**
 * Extracts a video ID from a YouTube URL or returns the ID if already valid.
 */
export function extractVideoId(input: string): string {
  const trimmed = input.trim();

  // Check if it's already a valid video ID
  if (isValidVideoId(trimmed)) {
    return trimmed;
  }

  // Try to extract from various YouTube URL formats
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtube\.com\/embed\/|youtu\.be\/|youtube\.com\/v\/|youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/,
  ];

  for (const pattern of patterns) {
    const match = trimmed.match(pattern);
    if (match?.[1]) {
      return match[1];
    }
  }

  throw new MostReplayedError(
    MostReplayedErrorCode.INVALID_VIDEO_ID,
    `Invalid YouTube video ID or URL: "${input}"`
  );
}

/**
 * Creates an AbortController with timeout support.
 */
function createTimeoutController(timeoutMs: number): {
  controller: AbortController;
  clear: () => void;
} {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  return {
    controller,
    clear: () => clearTimeout(timeoutId),
  };
}

/**
 * Fetches the YouTube video page HTML.
 */
async function fetchVideoPage(videoId: string, options: FetchOptions): Promise<string> {
  const fetchFn = options.fetch ?? globalThis.fetch;
  const timeout = options.timeout ?? DEFAULT_TIMEOUT;
  const userAgent = options.userAgent ?? DEFAULT_USER_AGENT;

  const url = `https://www.youtube.com/watch?v=${videoId}`;
  const { controller, clear } = createTimeoutController(timeout);

  try {
    const response = await fetchFn(url, {
      headers: {
        "Accept-Language": "en-US,en;q=0.9",
        "User-Agent": userAgent,
      },
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new MostReplayedError(
        MostReplayedErrorCode.FETCH_FAILED,
        `HTTP ${response.status}: ${response.statusText}`
      );
    }

    return await response.text();
  } catch (error) {
    if (error instanceof MostReplayedError) {
      throw error;
    }

    if (error instanceof Error && error.name === "AbortError") {
      throw new MostReplayedError(
        MostReplayedErrorCode.TIMEOUT,
        `Request timed out after ${timeout}ms`
      );
    }

    throw new MostReplayedError(
      MostReplayedErrorCode.FETCH_FAILED,
      `Failed to fetch video page: ${error instanceof Error ? error.message : String(error)}`,
      error instanceof Error ? error : undefined
    );
  } finally {
    clear();
  }
}

/**
 * Fetches the most replayed data for a YouTube video.
 *
 * @param videoIdOrUrl - A YouTube video ID (11 characters) or a full YouTube URL
 * @param options - Optional fetch configuration
 * @returns The most replayed data, or null if not available for this video
 *
 * @example
 * ```typescript
 * // Using a video ID
 * const data = await getMostReplayed("dQw4w9WgXcQ");
 *
 * // Using a full URL
 * const data = await getMostReplayed("https://www.youtube.com/watch?v=dQw4w9WgXcQ");
 *
 * if (data) {
 *   console.log(`Peak moment at ${data.peakSegment?.startMillis}ms`);
 *   console.log(`${data.markers.length} heatmap segments`);
 * }
 * ```
 */
export async function getMostReplayed(
  videoIdOrUrl: string,
  options: FetchOptions = {}
): Promise<MostReplayedData | null> {
  // Validate and extract video ID
  const videoId = extractVideoId(videoIdOrUrl);

  // Fetch the video page
  const html = await fetchVideoPage(videoId, options);

  // Parse the initial data
  const jsonString = extractInitialDataJson(html);
  const initialData = parseInitialData(jsonString);

  // Find the markers list data
  const markersListData = findMarkersListData(initialData);

  if (!markersListData?.markers || markersListData.markers.length === 0) {
    return null;
  }

  // Transform the raw data into clean typed structures
  const markers = transformMarkers(markersListData.markers);

  if (markers.length === 0) {
    return null;
  }

  const timedMarkerDecorations = markersListData.markersDecoration?.timedMarkerDecorations
    ? transformTimedMarkerDecorations(markersListData.markersDecoration.timedMarkerDecorations)
    : null;

  return {
    markers,
    timedMarkerDecorations:
      timedMarkerDecorations && timedMarkerDecorations.length > 0 ? timedMarkerDecorations : null,
    videoDurationMillis: estimateVideoDuration(markers, markersListData.markers),
    peakSegment: findPeakSegment(markers),
    averageIntensity: calculateAverageIntensity(markers),
  };
}
