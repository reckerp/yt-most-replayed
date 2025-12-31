import { describe, expect, it } from "bun:test";
import * as index from "../src/index.js";
import { MostReplayedErrorCode } from "../src/types.js";

describe("index (exports)", () => {
  describe("main API exports", () => {
    it("should export getMostReplayed function", () => {
      expect(index.getMostReplayed).toBeDefined();
      expect(typeof index.getMostReplayed).toBe("function");
    });

    it("should export getMostReplayedBatch function", () => {
      expect(index.getMostReplayedBatch).toBeDefined();
      expect(typeof index.getMostReplayedBatch).toBe("function");
    });

    it("should export extractVideoId function", () => {
      expect(index.extractVideoId).toBeDefined();
      expect(typeof index.extractVideoId).toBe("function");
    });

    it("should export isValidVideoId function", () => {
      expect(index.isValidVideoId).toBeDefined();
      expect(typeof index.isValidVideoId).toBe("function");
    });
  });

  describe("error exports", () => {
    it("should export MostReplayedError class", () => {
      expect(index.MostReplayedError).toBeDefined();
      expect(typeof index.MostReplayedError).toBe("function");
    });

    it("should export MostReplayedErrorCode enum", () => {
      expect(index.MostReplayedErrorCode).toBeDefined();
      expect(index.MostReplayedErrorCode.INVALID_VIDEO_ID).toBe(
        MostReplayedErrorCode.INVALID_VIDEO_ID
      );
      expect(index.MostReplayedErrorCode.FETCH_FAILED).toBe(MostReplayedErrorCode.FETCH_FAILED);
      expect(index.MostReplayedErrorCode.PARSE_FAILED).toBe(MostReplayedErrorCode.PARSE_FAILED);
      expect(index.MostReplayedErrorCode.NO_DATA_AVAILABLE).toBe(
        MostReplayedErrorCode.NO_DATA_AVAILABLE
      );
      expect(index.MostReplayedErrorCode.TIMEOUT).toBe(MostReplayedErrorCode.TIMEOUT);
    });
  });

  describe("utility exports", () => {
    it("should export formatTime function", () => {
      expect(index.formatTime).toBeDefined();
      expect(typeof index.formatTime).toBe("function");
    });

    it("should export getTopSegments function", () => {
      expect(index.getTopSegments).toBeDefined();
      expect(typeof index.getTopSegments).toBe("function");
    });

    it("should export getSegmentAtTime function", () => {
      expect(index.getSegmentAtTime).toBeDefined();
      expect(typeof index.getSegmentAtTime).toBe("function");
    });

    it("should export getSegmentDuration function", () => {
      expect(index.getSegmentDuration).toBeDefined();
      expect(typeof index.getSegmentDuration).toBe("function");
    });

    it("should export generateTimestampUrl function", () => {
      expect(index.generateTimestampUrl).toBeDefined();
      expect(typeof index.generateTimestampUrl).toBe("function");
    });

    it("should export filterByIntensity function", () => {
      expect(index.filterByIntensity).toBeDefined();
      expect(typeof index.filterByIntensity).toBe("function");
    });
  });

  describe("all expected exports are present", () => {
    it("should have exactly the expected number of exports", () => {
      const expectedExports = [
        // Main API
        "getMostReplayed",
        "getMostReplayedBatch",
        "extractVideoId",
        "isValidVideoId",
        // Errors
        "MostReplayedError",
        "MostReplayedErrorCode",
        // Utilities
        "formatTime",
        "getTopSegments",
        "getSegmentAtTime",
        "getSegmentDuration",
        "generateTimestampUrl",
        "filterByIntensity",
      ];

      for (const exp of expectedExports) {
        expect(index).toHaveProperty(exp);
      }
    });
  });
});
