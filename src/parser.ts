import {
  type HeatmapMarker,
  MostReplayedError,
  MostReplayedErrorCode,
  type TimedMarkerDecoration,
} from "./types.js";

/**
 * YouTube initial data structure (partial, only what we need).
 */
interface YouTubeInitialData {
  frameworkUpdates?: {
    entityBatchUpdate?: {
      mutations?: Mutation[];
    };
  };
}

interface Mutation {
  payload?: {
    macroMarkersListEntity?: {
      markersList?: MarkersListData;
    };
  };
}

interface MarkersListData {
  markers?: RawMarker[];
  markersDecoration?: {
    timedMarkerDecorations?: RawTimedMarkerDecoration[];
  };
}

interface RawMarker {
  startMillis?: string;
  durationMillis?: string;
  intensityScoreNormalized?: number;
}

interface RawTimedMarkerDecoration {
  visibleTimeRangeStartMillis?: string;
  visibleTimeRangeEndMillis?: string;
  label?: unknown;
  icon?: unknown;
  decorationTimeMillis?: unknown;
}

/**
 * Extracts the ytInitialData JSON string from YouTube HTML.
 */
export function extractInitialDataJson(html: string): string {
  const pattern = "var ytInitialData = ";
  const startIndex = html.indexOf(pattern);

  if (startIndex === -1) {
    throw new MostReplayedError(
      MostReplayedErrorCode.PARSE_FAILED,
      "Could not find ytInitialData in page HTML"
    );
  }

  const jsonStart = startIndex + pattern.length;
  const endIndex = html.indexOf(";</script>", jsonStart);

  if (endIndex === -1) {
    throw new MostReplayedError(
      MostReplayedErrorCode.PARSE_FAILED,
      "Could not find end of ytInitialData JSON"
    );
  }

  return html.slice(jsonStart, endIndex);
}

/**
 * Parses the ytInitialData JSON string.
 */
export function parseInitialData(jsonString: string): YouTubeInitialData {
  try {
    return JSON.parse(jsonString) as YouTubeInitialData;
  } catch (error) {
    throw new MostReplayedError(
      MostReplayedErrorCode.PARSE_FAILED,
      "Failed to parse ytInitialData JSON",
      error instanceof Error ? error : undefined
    );
  }
}

/**
 * Finds the markers list data from YouTube's initial data structure.
 */
export function findMarkersListData(data: YouTubeInitialData): MarkersListData | null {
  const mutations = data.frameworkUpdates?.entityBatchUpdate?.mutations;

  if (!mutations || !Array.isArray(mutations)) {
    return null;
  }

  for (const mutation of mutations) {
    const markersList = mutation.payload?.macroMarkersListEntity?.markersList;
    if (markersList?.markersDecoration) {
      return markersList;
    }
  }

  return null;
}

/**
 * Transforms raw markers into clean typed markers.
 */
export function transformMarkers(rawMarkers: RawMarker[]): HeatmapMarker[] {
  return rawMarkers
    .filter(
      (marker): marker is Required<Pick<RawMarker, "startMillis">> & RawMarker =>
        marker.startMillis !== undefined
    )
    .map((marker) => ({
      startMillis: parseInt(marker.startMillis, 10),
      durationMillis: marker.durationMillis ? parseInt(marker.durationMillis, 10) : 0,
      intensityScoreNormalized: marker.intensityScoreNormalized ?? 0,
    }))
    .sort((a, b) => a.startMillis - b.startMillis);
}

/**
 * Transforms raw timed marker decorations into clean typed decorations.
 */
export function transformTimedMarkerDecorations(
  rawDecorations: RawTimedMarkerDecoration[]
): TimedMarkerDecoration[] {
  return rawDecorations
    .filter(
      (
        decoration
      ): decoration is Required<
        Pick<RawTimedMarkerDecoration, "visibleTimeRangeStartMillis" | "visibleTimeRangeEndMillis">
      > &
        RawTimedMarkerDecoration =>
        decoration.visibleTimeRangeStartMillis !== undefined &&
        decoration.visibleTimeRangeEndMillis !== undefined
    )
    .map((decoration) => ({
      visibleTimeRangeStartMillis: parseInt(decoration.visibleTimeRangeStartMillis, 10),
      visibleTimeRangeEndMillis: parseInt(decoration.visibleTimeRangeEndMillis, 10),
    }))
    .sort((a, b) => a.visibleTimeRangeStartMillis - b.visibleTimeRangeStartMillis);
}

/**
 * Finds the peak segment (highest intensity).
 */
export function findPeakSegment(markers: HeatmapMarker[]): HeatmapMarker | null {
  if (markers.length === 0) {
    return null;
  }

  return markers.reduce((peak, current) =>
    current.intensityScoreNormalized > peak.intensityScoreNormalized ? current : peak
  );
}

/**
 * Calculates average intensity across all markers.
 */
export function calculateAverageIntensity(markers: HeatmapMarker[]): number {
  if (markers.length === 0) {
    return 0;
  }

  const sum = markers.reduce((acc, marker) => acc + marker.intensityScoreNormalized, 0);
  return sum / markers.length;
}

/**
 * Estimates video duration from markers (last marker start + assumed segment duration).
 */
export function estimateVideoDuration(markers: HeatmapMarker[], rawMarkers: RawMarker[]): number {
  if (markers.length === 0) {
    return 0;
  }

  // Try to find the segment duration from raw data
  const lastRawMarker = rawMarkers[rawMarkers.length - 1];
  const segmentDuration = lastRawMarker?.durationMillis
    ? parseInt(lastRawMarker.durationMillis, 10)
    : 0;

  const lastMarker = markers[markers.length - 1]!;
  return lastMarker.startMillis + segmentDuration;
}
