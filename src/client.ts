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
  type BatchFetchOptions,
  type BatchResult,
  type MostReplayedData,
  MostReplayedError,
  MostReplayedErrorCode,
} from "./types.js";

const DEFAULT_TIMEOUT = 10000;
const DEFAULT_RETRIES = 1;
const DEFAULT_RETRY_DELAY = 1000;
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
    `Invalid YouTube video ID or URL: "${input}"`,
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

function isRetryableStatus(status: number): boolean {
  return status >= 500 || status === 429;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchVideoPage(videoId: string, options: FetchOptions): Promise<string> {
  const fetchFn = options.fetch ?? globalThis.fetch;
  const timeout = options.timeout ?? DEFAULT_TIMEOUT;
  const userAgent = options.userAgent ?? DEFAULT_USER_AGENT;
  const maxRetries = options.retries ?? DEFAULT_RETRIES;
  const retryDelay = options.retryDelay ?? DEFAULT_RETRY_DELAY;

  const url = `https://www.youtube.com/watch?v=${videoId}`;

  let lastError: MostReplayedError | undefined;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
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
        const error = new MostReplayedError(
          MostReplayedErrorCode.FETCH_FAILED,
          `HTTP ${response.status}: ${response.statusText}`,
        );

        if (isRetryableStatus(response.status) && attempt < maxRetries) {
          lastError = error;
          clear();
          await sleep(retryDelay * attempt);
          continue;
        }

        throw error;
      }

      return await response.text();
    } catch (error) {
      clear();

      if (error instanceof MostReplayedError) {
        throw error;
      }

      if (error instanceof Error && error.name === "AbortError") {
        throw new MostReplayedError(
          MostReplayedErrorCode.TIMEOUT,
          `Request timed out after ${timeout}ms`,
        );
      }

      const fetchError = new MostReplayedError(
        MostReplayedErrorCode.FETCH_FAILED,
        `Failed to fetch video page: ${error instanceof Error ? error.message : String(error)}`,
        error instanceof Error ? error : undefined,
      );

      if (attempt < maxRetries) {
        lastError = fetchError;
        await sleep(retryDelay * attempt);
        continue;
      }

      throw fetchError;
    } finally {
      clear();
    }
  }

  throw lastError ?? new MostReplayedError(MostReplayedErrorCode.FETCH_FAILED, "Request failed");
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
  options: FetchOptions = {},
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

const DEFAULT_CONCURRENCY = 5;

/**
 * Fetches the most replayed data for multiple YouTube videos in parallel.
 *
 * @param videoIdsOrUrls - Array of YouTube video IDs or URLs
 * @param options - Optional batch fetch configuration
 * @returns Array of batch results containing data or errors for each video
 *
 * @example
 * ```typescript
 * const results = await getMostReplayedBatch([
 *   "dQw4w9WgXcQ",
 *   "https://www.youtube.com/watch?v=9bZkp7q19f0"
 * ]);
 *
 * for (const result of results) {
 *   if (result.error) {
 *     console.error(`Failed for ${result.videoId}: ${result.error.message}`);
 *   } else if (result.data) {
 *     console.log(`${result.videoId}: ${result.data.markers.length} markers`);
 *   }
 * }
 * ```
 */
export async function getMostReplayedBatch(
  videoIdsOrUrls: string[],
  options: BatchFetchOptions = {},
): Promise<BatchResult[]> {
  const concurrency = options.concurrency ?? DEFAULT_CONCURRENCY;

  // Extract and validate all video IDs first
  const videoIds: Array<{ original: string; videoId: string | null; error?: MostReplayedError }> =
    videoIdsOrUrls.map((input) => {
      try {
        return { original: input, videoId: extractVideoId(input) };
      } catch (error) {
        return {
          original: input,
          videoId: null,
          error: error instanceof MostReplayedError ? error : undefined,
        };
      }
    });

  const results: BatchResult[] = new Array(videoIdsOrUrls.length);

  // Process items that had validation errors immediately
  for (let i = 0; i < videoIds.length; i++) {
    const item = videoIds[i]!;
    if (item.error) {
      results[i] = {
        videoId: item.original,
        data: null,
        error: item.error,
      };
    }
  }

  // Get valid video IDs with their original indices
  const validItems = videoIds
    .map((item, index) => ({ ...item, index }))
    .filter((item) => item.videoId !== null) as Array<{
    original: string;
    videoId: string;
    index: number;
  }>;

  // Process in batches with concurrency limit
  for (let i = 0; i < validItems.length; i += concurrency) {
    const batch = validItems.slice(i, i + concurrency);

    const batchPromises = batch.map(async (item) => {
      try {
        const data = await getMostReplayed(item.videoId, options);
        return { index: item.index, videoId: item.videoId, data, error: undefined };
      } catch (error) {
        return {
          index: item.index,
          videoId: item.videoId,
          data: null,
          error: error instanceof MostReplayedError ? error : undefined,
        };
      }
    });

    const batchResults = await Promise.all(batchPromises);

    for (const result of batchResults) {
      results[result.index] = {
        videoId: result.videoId,
        data: result.data,
        error: result.error,
      };
    }
  }

  return results;
}
