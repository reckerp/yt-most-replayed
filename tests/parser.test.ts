import { describe, expect, it } from "bun:test";
import {
  calculateAverageIntensity,
  estimateVideoDuration,
  extractInitialDataJson,
  findMarkersListData,
  findPeakSegment,
  parseInitialData,
  transformMarkers,
  transformTimedMarkerDecorations,
} from "../src/parser.js";
import type { HeatmapMarker } from "../src/types.js";
import { MostReplayedError, MostReplayedErrorCode } from "../src/types.js";

function marker(startMillis: number, intensity: number, duration = 5000): HeatmapMarker {
  return { startMillis, durationMillis: duration, intensityScoreNormalized: intensity };
}

describe("parser", () => {
  describe("extractInitialDataJson", () => {
    it("should extract ytInitialData from valid HTML", () => {
      const html = `
        <html>
          <script>var ytInitialData = {"test": "value"};</script>
        </html>
      `;
      const result = extractInitialDataJson(html);
      expect(result).toBe('{"test": "value"}');
    });

    it("should throw PARSE_FAILED error when ytInitialData is not found", () => {
      const html = "<html><body>No data here</body></html>";
      expect(() => extractInitialDataJson(html)).toThrow(MostReplayedError);
      try {
        extractInitialDataJson(html);
      } catch (error) {
        expect(error).toBeInstanceOf(MostReplayedError);
        expect((error as MostReplayedError).code).toBe(MostReplayedErrorCode.PARSE_FAILED);
        expect((error as MostReplayedError).message).toContain("Could not find ytInitialData");
      }
    });

    it("should throw PARSE_FAILED error when end of JSON is not found", () => {
      const html = "<html><script>var ytInitialData = {unclosed</html>";
      expect(() => extractInitialDataJson(html)).toThrow(MostReplayedError);
      try {
        extractInitialDataJson(html);
      } catch (error) {
        expect(error).toBeInstanceOf(MostReplayedError);
        expect((error as MostReplayedError).code).toBe(MostReplayedErrorCode.PARSE_FAILED);
        expect((error as MostReplayedError).message).toContain(
          "Could not find end of ytInitialData"
        );
      }
    });

    it("should extract complex nested JSON", () => {
      const complexData = {
        frameworkUpdates: {
          entityBatchUpdate: {
            mutations: [{ payload: { test: 123 } }],
          },
        },
      };
      const html = `<script>var ytInitialData = ${JSON.stringify(complexData)};</script>`;
      const result = extractInitialDataJson(html);
      expect(JSON.parse(result)).toEqual(complexData);
    });
  });

  describe("parseInitialData", () => {
    it("should parse valid JSON string", () => {
      const data = { frameworkUpdates: { entityBatchUpdate: { mutations: [] } } };
      const result = parseInitialData(JSON.stringify(data));
      expect(result).toEqual(data);
    });

    it("should throw PARSE_FAILED error for invalid JSON", () => {
      expect(() => parseInitialData("{ invalid json }")).toThrow(MostReplayedError);
      try {
        parseInitialData("{ invalid json }");
      } catch (error) {
        expect(error).toBeInstanceOf(MostReplayedError);
        expect((error as MostReplayedError).code).toBe(MostReplayedErrorCode.PARSE_FAILED);
        expect((error as MostReplayedError).message).toContain(
          "Failed to parse ytInitialData JSON"
        );
      }
    });

    it("should handle empty object", () => {
      const result = parseInitialData("{}");
      expect(result).toEqual({});
    });
  });

  describe("findMarkersListData", () => {
    it("should find markers list data in valid structure", () => {
      const data = {
        frameworkUpdates: {
          entityBatchUpdate: {
            mutations: [
              {
                payload: {
                  macroMarkersListEntity: {
                    markersList: {
                      markers: [{ startMillis: "0", intensityScoreNormalized: 0.5 }],
                      markersDecoration: {
                        timedMarkerDecorations: [],
                      },
                    },
                  },
                },
              },
            ],
          },
        },
      };
      const result = findMarkersListData(data);
      expect(result).not.toBeNull();
      expect(result?.markers).toHaveLength(1);
    });

    it("should return null when frameworkUpdates is missing", () => {
      const result = findMarkersListData({});
      expect(result).toBeNull();
    });

    it("should return null when mutations is missing", () => {
      const result = findMarkersListData({
        frameworkUpdates: {
          entityBatchUpdate: {},
        },
      });
      expect(result).toBeNull();
    });

    it("should return null when mutations is empty", () => {
      const result = findMarkersListData({
        frameworkUpdates: {
          entityBatchUpdate: {
            mutations: [],
          },
        },
      });
      expect(result).toBeNull();
    });

    it("should return null when markersDecoration is missing", () => {
      const result = findMarkersListData({
        frameworkUpdates: {
          entityBatchUpdate: {
            mutations: [
              {
                payload: {
                  macroMarkersListEntity: {
                    markersList: {
                      markers: [{ startMillis: "0" }],
                      // No markersDecoration
                    },
                  },
                },
              },
            ],
          },
        },
      });
      expect(result).toBeNull();
    });

    it("should skip mutations without valid data and find valid one", () => {
      const data = {
        frameworkUpdates: {
          entityBatchUpdate: {
            mutations: [
              { payload: {} },
              { payload: { other: "data" } },
              {
                payload: {
                  macroMarkersListEntity: {
                    markersList: {
                      markers: [{ startMillis: "1000" }],
                      markersDecoration: {
                        timedMarkerDecorations: [],
                      },
                    },
                  },
                },
              },
            ],
          },
        },
      };
      const result = findMarkersListData(data);
      expect(result).not.toBeNull();
      expect(result?.markers?.[0]?.startMillis).toBe("1000");
    });
  });

  describe("transformMarkers", () => {
    it("should transform raw markers into typed markers with durationMillis", () => {
      const rawMarkers = [
        { startMillis: "1000", durationMillis: "5000", intensityScoreNormalized: 0.8 },
        { startMillis: "6000", durationMillis: "5000", intensityScoreNormalized: 0.3 },
      ];
      const result = transformMarkers(rawMarkers);
      expect(result).toEqual([
        { startMillis: 1000, durationMillis: 5000, intensityScoreNormalized: 0.8 },
        { startMillis: 6000, durationMillis: 5000, intensityScoreNormalized: 0.3 },
      ]);
    });

    it("should filter out markers without startMillis", () => {
      const rawMarkers = [
        { startMillis: "1000", durationMillis: "5000", intensityScoreNormalized: 0.5 },
        { intensityScoreNormalized: 0.3 },
        { startMillis: "2000", durationMillis: "5000", intensityScoreNormalized: 0.7 },
      ];
      const result = transformMarkers(rawMarkers);
      expect(result).toHaveLength(2);
    });

    it("should default intensityScoreNormalized to 0 and durationMillis to 0 when missing", () => {
      const rawMarkers = [{ startMillis: "1000" }];
      const result = transformMarkers(rawMarkers);
      expect(result[0]?.intensityScoreNormalized).toBe(0);
      expect(result[0]?.durationMillis).toBe(0);
    });

    it("should sort markers by startMillis", () => {
      const rawMarkers = [
        { startMillis: "3000", intensityScoreNormalized: 0.3 },
        { startMillis: "1000", intensityScoreNormalized: 0.1 },
        { startMillis: "2000", intensityScoreNormalized: 0.2 },
      ];
      const result = transformMarkers(rawMarkers);
      expect(result[0]?.startMillis).toBe(1000);
      expect(result[1]?.startMillis).toBe(2000);
      expect(result[2]?.startMillis).toBe(3000);
    });

    it("should handle empty array", () => {
      const result = transformMarkers([]);
      expect(result).toEqual([]);
    });
  });

  describe("transformTimedMarkerDecorations", () => {
    it("should transform raw decorations into typed decorations", () => {
      const rawDecorations = [
        { visibleTimeRangeStartMillis: "0", visibleTimeRangeEndMillis: "10000" },
        { visibleTimeRangeStartMillis: "10000", visibleTimeRangeEndMillis: "20000" },
      ];
      const result = transformTimedMarkerDecorations(rawDecorations);
      expect(result).toEqual([
        { visibleTimeRangeStartMillis: 0, visibleTimeRangeEndMillis: 10000 },
        { visibleTimeRangeStartMillis: 10000, visibleTimeRangeEndMillis: 20000 },
      ]);
    });

    it("should filter out decorations missing start or end time", () => {
      const rawDecorations = [
        { visibleTimeRangeStartMillis: "0", visibleTimeRangeEndMillis: "10000" },
        { visibleTimeRangeStartMillis: "10000" }, // Missing end
        { visibleTimeRangeEndMillis: "30000" }, // Missing start
        { visibleTimeRangeStartMillis: "20000", visibleTimeRangeEndMillis: "30000" },
      ];
      const result = transformTimedMarkerDecorations(rawDecorations);
      expect(result).toHaveLength(2);
    });

    it("should sort by visibleTimeRangeStartMillis", () => {
      const rawDecorations = [
        { visibleTimeRangeStartMillis: "20000", visibleTimeRangeEndMillis: "30000" },
        { visibleTimeRangeStartMillis: "0", visibleTimeRangeEndMillis: "10000" },
        { visibleTimeRangeStartMillis: "10000", visibleTimeRangeEndMillis: "20000" },
      ];
      const result = transformTimedMarkerDecorations(rawDecorations);
      expect(result[0]?.visibleTimeRangeStartMillis).toBe(0);
      expect(result[1]?.visibleTimeRangeStartMillis).toBe(10000);
      expect(result[2]?.visibleTimeRangeStartMillis).toBe(20000);
    });

    it("should handle empty array", () => {
      const result = transformTimedMarkerDecorations([]);
      expect(result).toEqual([]);
    });
  });

  describe("findPeakSegment", () => {
    it("should find the marker with highest intensity", () => {
      const markers = [marker(0, 0.3), marker(1000, 0.9), marker(2000, 0.5)];
      const result = findPeakSegment(markers);
      expect(result).toEqual(marker(1000, 0.9));
    });

    it("should return null for empty array", () => {
      const result = findPeakSegment([]);
      expect(result).toBeNull();
    });

    it("should return first peak when multiple have same intensity", () => {
      const markers = [marker(0, 1.0), marker(1000, 1.0)];
      const result = findPeakSegment(markers);
      expect(result?.startMillis).toBe(0);
    });

    it("should handle single marker", () => {
      const markers = [marker(5000, 0.5)];
      const result = findPeakSegment(markers);
      expect(result).toEqual(marker(5000, 0.5));
    });
  });

  describe("calculateAverageIntensity", () => {
    it("should calculate average intensity correctly", () => {
      const markers = [marker(0, 0.2), marker(1000, 0.4), marker(2000, 0.6)];
      const result = calculateAverageIntensity(markers);
      expect(result).toBeCloseTo(0.4, 10);
    });

    it("should return 0 for empty array", () => {
      const result = calculateAverageIntensity([]);
      expect(result).toBe(0);
    });

    it("should handle single marker", () => {
      const markers = [marker(0, 0.75)];
      const result = calculateAverageIntensity(markers);
      expect(result).toBe(0.75);
    });

    it("should handle all zero intensities", () => {
      const markers = [marker(0, 0), marker(1000, 0)];
      const result = calculateAverageIntensity(markers);
      expect(result).toBe(0);
    });
  });

  describe("estimateVideoDuration", () => {
    it("should estimate duration from last marker plus segment duration", () => {
      const markers = [marker(0, 0.5), marker(5000, 0.5), marker(10000, 0.5)];
      const rawMarkers = [
        { startMillis: "0", durationMillis: "5000" },
        { startMillis: "5000", durationMillis: "5000" },
        { startMillis: "10000", durationMillis: "5000" },
      ];
      const result = estimateVideoDuration(markers, rawMarkers);
      expect(result).toBe(15000);
    });

    it("should return 0 for empty markers", () => {
      const result = estimateVideoDuration([], []);
      expect(result).toBe(0);
    });

    it("should handle missing durationMillis in raw markers", () => {
      const markers = [marker(10000, 0.5)];
      const rawMarkers = [{ startMillis: "10000" }];
      const result = estimateVideoDuration(markers, rawMarkers);
      expect(result).toBe(10000);
    });
  });
});
