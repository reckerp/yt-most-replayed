import { describe, expect, it } from "bun:test";
import { MostReplayedError, MostReplayedErrorCode } from "../src/types.js";

describe("types", () => {
  describe("MostReplayedError", () => {
    it("should create error with code and message", () => {
      const error = new MostReplayedError(MostReplayedErrorCode.INVALID_VIDEO_ID, "Test message");

      expect(error.code).toBe(MostReplayedErrorCode.INVALID_VIDEO_ID);
      expect(error.message).toBe("Test message");
      expect(error.name).toBe("MostReplayedError");
      expect(error.cause).toBeUndefined();
    });

    it("should create error with cause", () => {
      const cause = new Error("Original error");
      const error = new MostReplayedError(
        MostReplayedErrorCode.FETCH_FAILED,
        "Failed to fetch",
        cause
      );

      expect(error.code).toBe(MostReplayedErrorCode.FETCH_FAILED);
      expect(error.message).toBe("Failed to fetch");
      expect(error.cause).toBe(cause);
    });

    it("should be an instance of Error", () => {
      const error = new MostReplayedError(MostReplayedErrorCode.PARSE_FAILED, "Parse error");
      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(MostReplayedError);
    });

    it("should have proper prototype chain", () => {
      const error = new MostReplayedError(MostReplayedErrorCode.TIMEOUT, "Timeout");
      expect(Object.getPrototypeOf(error)).toBe(MostReplayedError.prototype);
    });

    it("should work with all error codes", () => {
      const errorCodes = [
        MostReplayedErrorCode.INVALID_VIDEO_ID,
        MostReplayedErrorCode.FETCH_FAILED,
        MostReplayedErrorCode.PARSE_FAILED,
        MostReplayedErrorCode.NO_DATA_AVAILABLE,
        MostReplayedErrorCode.TIMEOUT,
      ];

      for (const code of errorCodes) {
        const error = new MostReplayedError(code, `Error with code ${code}`);
        expect(error.code).toBe(code);
      }
    });

    it("should be catchable in try/catch", () => {
      try {
        throw new MostReplayedError(MostReplayedErrorCode.INVALID_VIDEO_ID, "Test");
      } catch (error) {
        expect(error).toBeInstanceOf(MostReplayedError);
        expect((error as MostReplayedError).code).toBe(MostReplayedErrorCode.INVALID_VIDEO_ID);
      }
    });

    it("should have a stack trace", () => {
      const error = new MostReplayedError(MostReplayedErrorCode.FETCH_FAILED, "Test");
      expect(error.stack).toBeDefined();
      expect(typeof error.stack).toBe("string");
    });
  });

  describe("MostReplayedErrorCode", () => {
    it("should have correct enum values", () => {
      expect(MostReplayedErrorCode.INVALID_VIDEO_ID).toBe(MostReplayedErrorCode.INVALID_VIDEO_ID);
      expect(MostReplayedErrorCode.FETCH_FAILED).toBe(MostReplayedErrorCode.FETCH_FAILED);
      expect(MostReplayedErrorCode.PARSE_FAILED).toBe(MostReplayedErrorCode.PARSE_FAILED);
      expect(MostReplayedErrorCode.NO_DATA_AVAILABLE).toBe(MostReplayedErrorCode.NO_DATA_AVAILABLE);
      expect(MostReplayedErrorCode.TIMEOUT).toBe(MostReplayedErrorCode.TIMEOUT);
    });

    it("should have string values for all codes", () => {
      expect(typeof MostReplayedErrorCode.INVALID_VIDEO_ID).toBe("string");
      expect(typeof MostReplayedErrorCode.FETCH_FAILED).toBe("string");
      expect(typeof MostReplayedErrorCode.PARSE_FAILED).toBe("string");
      expect(typeof MostReplayedErrorCode.NO_DATA_AVAILABLE).toBe("string");
      expect(typeof MostReplayedErrorCode.TIMEOUT).toBe("string");
    });
  });
});
