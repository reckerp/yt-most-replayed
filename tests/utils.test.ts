import { describe, expect, it } from "bun:test";
import type { HeatmapMarker, MostReplayedData } from "../src/types.js";
import {
  filterByIntensity,
  formatTime,
  generateTimestampUrl,
  getSegmentAtTime,
  getSegmentDuration,
  getTopSegments,
} from "../src/utils.js";

function createMarker(startMillis: number, intensityScoreNormalized: number): HeatmapMarker {
  return { startMillis, durationMillis: 5000, intensityScoreNormalized };
}

function createTestData(
  markerInputs: Array<{ startMillis: number; intensityScoreNormalized: number }>
): MostReplayedData {
  const markers = markerInputs.map((m) => createMarker(m.startMillis, m.intensityScoreNormalized));
  return {
    markers,
    timedMarkerDecorations: null,
    videoDurationMillis: markers.length > 0 ? markers[markers.length - 1]!.startMillis + 5000 : 0,
    peakSegment:
      markers.length > 0
        ? markers.reduce((a, b) =>
            a.intensityScoreNormalized > b.intensityScoreNormalized ? a : b
          )
        : null,
    averageIntensity:
      markers.length > 0
        ? markers.reduce((sum, m) => sum + m.intensityScoreNormalized, 0) / markers.length
        : 0,
  };
}

describe("utils", () => {
  describe("formatTime", () => {
    it("should format seconds correctly", () => {
      expect(formatTime(0)).toBe("0:00");
      expect(formatTime(1000)).toBe("0:01");
      expect(formatTime(30000)).toBe("0:30");
      expect(formatTime(59000)).toBe("0:59");
    });

    it("should format minutes and seconds correctly", () => {
      expect(formatTime(60000)).toBe("1:00");
      expect(formatTime(90000)).toBe("1:30");
      expect(formatTime(300000)).toBe("5:00");
      expect(formatTime(599000)).toBe("9:59");
    });

    it("should format hours, minutes, and seconds correctly", () => {
      expect(formatTime(3600000)).toBe("1:00:00");
      expect(formatTime(3661000)).toBe("1:01:01");
      expect(formatTime(7200000)).toBe("2:00:00");
      expect(formatTime(36000000)).toBe("10:00:00");
    });

    it("should pad minutes and seconds with leading zeros", () => {
      expect(formatTime(3605000)).toBe("1:00:05");
      expect(formatTime(3665000)).toBe("1:01:05");
      expect(formatTime(5000)).toBe("0:05");
    });

    it("should handle milliseconds that don't result in full seconds", () => {
      expect(formatTime(1500)).toBe("0:01");
      expect(formatTime(999)).toBe("0:00");
      expect(formatTime(61999)).toBe("1:01");
    });
  });

  describe("getTopSegments", () => {
    it("should return top segments sorted by intensity descending", () => {
      const data = createTestData([
        { startMillis: 0, intensityScoreNormalized: 0.3 },
        { startMillis: 5000, intensityScoreNormalized: 0.9 },
        { startMillis: 10000, intensityScoreNormalized: 0.5 },
        { startMillis: 15000, intensityScoreNormalized: 0.7 },
        { startMillis: 20000, intensityScoreNormalized: 0.1 },
      ]);

      const result = getTopSegments(data, 3);
      expect(result).toHaveLength(3);
      expect(result[0]?.intensityScoreNormalized).toBe(0.9);
      expect(result[1]?.intensityScoreNormalized).toBe(0.7);
      expect(result[2]?.intensityScoreNormalized).toBe(0.5);
    });

    it("should return default 5 segments when count not specified", () => {
      const markers = Array.from({ length: 10 }, (_, i) => ({
        startMillis: i * 1000,
        intensityScoreNormalized: i / 10,
      }));
      const data = createTestData(markers);

      const result = getTopSegments(data);
      expect(result).toHaveLength(5);
    });

    it("should return all segments if count exceeds available segments", () => {
      const data = createTestData([
        { startMillis: 0, intensityScoreNormalized: 0.5 },
        { startMillis: 5000, intensityScoreNormalized: 0.3 },
      ]);

      const result = getTopSegments(data, 10);
      expect(result).toHaveLength(2);
    });

    it("should return empty array for empty markers", () => {
      const data = createTestData([]);
      const result = getTopSegments(data, 5);
      expect(result).toEqual([]);
    });

    it("should not mutate original markers array", () => {
      const data = createTestData([
        { startMillis: 0, intensityScoreNormalized: 0.3 },
        { startMillis: 5000, intensityScoreNormalized: 0.9 },
      ]);
      const originalOrder = [...data.markers];

      getTopSegments(data, 2);

      expect(data.markers[0]?.intensityScoreNormalized).toBe(
        originalOrder[0]?.intensityScoreNormalized
      );
      expect(data.markers[1]?.intensityScoreNormalized).toBe(
        originalOrder[1]?.intensityScoreNormalized
      );
    });
  });

  describe("getSegmentAtTime", () => {
    it("should return the segment containing the given time", () => {
      const data = createTestData([
        { startMillis: 0, intensityScoreNormalized: 0.3 },
        { startMillis: 5000, intensityScoreNormalized: 0.5 },
        { startMillis: 10000, intensityScoreNormalized: 0.7 },
      ]);

      expect(getSegmentAtTime(data, 0)).toEqual(createMarker(0, 0.3));
      expect(getSegmentAtTime(data, 2500)).toEqual(createMarker(0, 0.3));
      expect(getSegmentAtTime(data, 5000)).toEqual(createMarker(5000, 0.5));
      expect(getSegmentAtTime(data, 7500)).toEqual(createMarker(5000, 0.5));
      expect(getSegmentAtTime(data, 15000)).toEqual(createMarker(10000, 0.7));
    });

    it("should return null if time is before first segment", () => {
      const data = createTestData([{ startMillis: 5000, intensityScoreNormalized: 0.5 }]);

      const result = getSegmentAtTime(data, 1000);
      expect(result).toBeNull();
    });

    it("should return null for empty markers", () => {
      const data = createTestData([]);
      const result = getSegmentAtTime(data, 5000);
      expect(result).toBeNull();
    });

    it("should handle exact boundary times", () => {
      const data = createTestData([
        { startMillis: 0, intensityScoreNormalized: 0.3 },
        { startMillis: 5000, intensityScoreNormalized: 0.5 },
      ]);

      expect(getSegmentAtTime(data, 4999)).toEqual(createMarker(0, 0.3));
      expect(getSegmentAtTime(data, 5000)).toEqual(createMarker(5000, 0.5));
    });
  });

  describe("getSegmentDuration", () => {
    it("should return durationMillis from first marker", () => {
      const data = createTestData([
        { startMillis: 0, intensityScoreNormalized: 0.5 },
        { startMillis: 5000, intensityScoreNormalized: 0.5 },
        { startMillis: 10000, intensityScoreNormalized: 0.5 },
      ]);

      expect(getSegmentDuration(data)).toBe(5000);
    });

    it("should return durationMillis for single marker", () => {
      const data = createTestData([{ startMillis: 0, intensityScoreNormalized: 0.5 }]);

      expect(getSegmentDuration(data)).toBe(5000);
    });

    it("should return 0 for empty markers", () => {
      const data = createTestData([]);
      expect(getSegmentDuration(data)).toBe(0);
    });
  });

  describe("generateTimestampUrl", () => {
    it("should generate correct YouTube URL with timestamp", () => {
      expect(generateTimestampUrl("dQw4w9WgXcQ", 0)).toBe(
        "https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=0"
      );
      expect(generateTimestampUrl("dQw4w9WgXcQ", 60000)).toBe(
        "https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=60"
      );
      expect(generateTimestampUrl("dQw4w9WgXcQ", 3600000)).toBe(
        "https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=3600"
      );
    });

    it("should floor milliseconds to seconds", () => {
      expect(generateTimestampUrl("abc123XYZ_-", 1500)).toBe(
        "https://www.youtube.com/watch?v=abc123XYZ_-&t=1"
      );
      expect(generateTimestampUrl("abc123XYZ_-", 999)).toBe(
        "https://www.youtube.com/watch?v=abc123XYZ_-&t=0"
      );
      expect(generateTimestampUrl("abc123XYZ_-", 59999)).toBe(
        "https://www.youtube.com/watch?v=abc123XYZ_-&t=59"
      );
    });
  });

  describe("filterByIntensity", () => {
    it("should filter segments by intensity threshold", () => {
      const data = createTestData([
        { startMillis: 0, intensityScoreNormalized: 0.2 },
        { startMillis: 5000, intensityScoreNormalized: 0.5 },
        { startMillis: 10000, intensityScoreNormalized: 0.8 },
        { startMillis: 15000, intensityScoreNormalized: 0.3 },
      ]);

      const result = filterByIntensity(data, 0.5);
      expect(result).toHaveLength(2);
      expect(result[0]?.intensityScoreNormalized).toBe(0.5);
      expect(result[1]?.intensityScoreNormalized).toBe(0.8);
    });

    it("should return all segments when threshold is 0", () => {
      const data = createTestData([
        { startMillis: 0, intensityScoreNormalized: 0.1 },
        { startMillis: 5000, intensityScoreNormalized: 0.5 },
      ]);

      const result = filterByIntensity(data, 0);
      expect(result).toHaveLength(2);
    });

    it("should return empty array when no segments meet threshold", () => {
      const data = createTestData([
        { startMillis: 0, intensityScoreNormalized: 0.1 },
        { startMillis: 5000, intensityScoreNormalized: 0.2 },
      ]);

      const result = filterByIntensity(data, 0.5);
      expect(result).toEqual([]);
    });

    it("should include segments exactly at threshold", () => {
      const data = createTestData([
        { startMillis: 0, intensityScoreNormalized: 0.5 },
        { startMillis: 5000, intensityScoreNormalized: 0.49 },
      ]);

      const result = filterByIntensity(data, 0.5);
      expect(result).toHaveLength(1);
      expect(result[0]?.intensityScoreNormalized).toBe(0.5);
    });

    it("should handle threshold of 1.0", () => {
      const data = createTestData([
        { startMillis: 0, intensityScoreNormalized: 0.99 },
        { startMillis: 5000, intensityScoreNormalized: 1.0 },
      ]);

      const result = filterByIntensity(data, 1.0);
      expect(result).toHaveLength(1);
      expect(result[0]?.intensityScoreNormalized).toBe(1.0);
    });

    it("should preserve original order of markers", () => {
      const data = createTestData([
        { startMillis: 0, intensityScoreNormalized: 0.9 },
        { startMillis: 5000, intensityScoreNormalized: 0.6 },
        { startMillis: 10000, intensityScoreNormalized: 0.7 },
      ]);

      const result = filterByIntensity(data, 0.5);
      expect(result[0]?.startMillis).toBe(0);
      expect(result[1]?.startMillis).toBe(5000);
      expect(result[2]?.startMillis).toBe(10000);
    });
  });
});
