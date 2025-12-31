import { describe, expect, it, mock } from "bun:test";
import { extractVideoId, getMostReplayed, getMostReplayedBatch, isValidVideoId } from "../src/client.js";
import { MostReplayedError, MostReplayedErrorCode } from "../src/types.js";

// Helper to create a mock fetch function that matches the expected type
function createMockFetch(
  handler: (url: string, options?: RequestInit) => Promise<Response>
): typeof globalThis.fetch {
  return handler as typeof globalThis.fetch;
}

describe("client", () => {
  describe("isValidVideoId", () => {
    it("should return true for valid 11-character video IDs", () => {
      expect(isValidVideoId("dQw4w9WgXcQ")).toBe(true);
      expect(isValidVideoId("abcdefghijk")).toBe(true);
      expect(isValidVideoId("ABCDEFGHIJK")).toBe(true);
      expect(isValidVideoId("12345678901")).toBe(true);
      expect(isValidVideoId("abc-_123XYZ")).toBe(true);
    });

    it("should return false for IDs that are too short", () => {
      expect(isValidVideoId("abc")).toBe(false);
      expect(isValidVideoId("1234567890")).toBe(false);
    });

    it("should return false for IDs that are too long", () => {
      expect(isValidVideoId("123456789012")).toBe(false);
      expect(isValidVideoId("dQw4w9WgXcQx")).toBe(false);
    });

    it("should return false for IDs with invalid characters", () => {
      expect(isValidVideoId("abc def ghij")).toBe(false);
      expect(isValidVideoId("abc!@#$%^&*(")).toBe(false);
      expect(isValidVideoId("abc.def.ghi")).toBe(false);
    });

    it("should return false for empty string", () => {
      expect(isValidVideoId("")).toBe(false);
    });
  });

  describe("extractVideoId", () => {
    it("should return the ID directly if already valid", () => {
      expect(extractVideoId("dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
    });

    it("should trim whitespace from valid IDs", () => {
      expect(extractVideoId("  dQw4w9WgXcQ  ")).toBe("dQw4w9WgXcQ");
    });

    it("should extract ID from youtube.com/watch?v= URLs", () => {
      expect(extractVideoId("https://www.youtube.com/watch?v=dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
      expect(extractVideoId("http://youtube.com/watch?v=dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
      expect(extractVideoId("https://youtube.com/watch?v=dQw4w9WgXcQ&feature=share")).toBe(
        "dQw4w9WgXcQ"
      );
    });

    it("should extract ID from youtu.be short URLs", () => {
      expect(extractVideoId("https://youtu.be/dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
      expect(extractVideoId("http://youtu.be/dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
      expect(extractVideoId("https://youtu.be/dQw4w9WgXcQ?t=120")).toBe("dQw4w9WgXcQ");
    });

    it("should extract ID from youtube.com/embed/ URLs", () => {
      expect(extractVideoId("https://www.youtube.com/embed/dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
    });

    it("should extract ID from youtube.com/v/ URLs", () => {
      expect(extractVideoId("https://www.youtube.com/v/dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
    });

    it("should extract ID from youtube.com/shorts/ URLs", () => {
      expect(extractVideoId("https://www.youtube.com/shorts/dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
    });

    it("should throw INVALID_VIDEO_ID error for invalid input", () => {
      expect(() => extractVideoId("invalid")).toThrow(MostReplayedError);
      try {
        extractVideoId("not-a-valid-id");
      } catch (error) {
        expect(error).toBeInstanceOf(MostReplayedError);
        expect((error as MostReplayedError).code).toBe(MostReplayedErrorCode.INVALID_VIDEO_ID);
      }
    });

    it("should throw for non-YouTube URLs", () => {
      expect(() => extractVideoId("https://vimeo.com/123456")).toThrow(MostReplayedError);
      expect(() => extractVideoId("https://example.com/video")).toThrow(MostReplayedError);
    });
  });

  describe("getMostReplayed", () => {
    it("should return null when no markers data is available", async () => {
      const mockHtml = `
        <html>
          <script>var ytInitialData = ${JSON.stringify({
            frameworkUpdates: {
              entityBatchUpdate: {
                mutations: [],
              },
            },
          })};</script>
        </html>
      `;

      const mockFetch = createMockFetch(() =>
        Promise.resolve(new Response(mockHtml, { status: 200, statusText: "OK" }))
      );

      const result = await getMostReplayed("dQw4w9WgXcQ", { fetch: mockFetch });
      expect(result).toBeNull();
    });

    it("should return MostReplayedData when data is available", async () => {
      const mockHtml = `
        <html>
          <script>var ytInitialData = ${JSON.stringify({
            frameworkUpdates: {
              entityBatchUpdate: {
                mutations: [
                  {
                    payload: {
                      macroMarkersListEntity: {
                        markersList: {
                          markers: [
                            {
                              startMillis: "0",
                              durationMillis: "5000",
                              intensityScoreNormalized: 0.5,
                            },
                            {
                              startMillis: "5000",
                              durationMillis: "5000",
                              intensityScoreNormalized: 0.8,
                            },
                            {
                              startMillis: "10000",
                              durationMillis: "5000",
                              intensityScoreNormalized: 0.3,
                            },
                          ],
                          markersDecoration: {
                            timedMarkerDecorations: [
                              {
                                visibleTimeRangeStartMillis: "0",
                                visibleTimeRangeEndMillis: "15000",
                              },
                            ],
                          },
                        },
                      },
                    },
                  },
                ],
              },
            },
          })};</script>
        </html>
      `;

      const mockFetch = createMockFetch(() =>
        Promise.resolve(new Response(mockHtml, { status: 200, statusText: "OK" }))
      );

      const result = await getMostReplayed("dQw4w9WgXcQ", { fetch: mockFetch });

      expect(result).not.toBeNull();
      expect(result?.markers).toHaveLength(3);
      expect(result?.peakSegment?.intensityScoreNormalized).toBe(0.8);
      expect(result?.averageIntensity).toBeCloseTo(0.533, 2);
      expect(result?.videoDurationMillis).toBe(15000);
      expect(result?.timedMarkerDecorations).toHaveLength(1);
    });

    it("should handle URLs as input", async () => {
      const mockHtml = `
        <html>
          <script>var ytInitialData = ${JSON.stringify({
            frameworkUpdates: {
              entityBatchUpdate: {
                mutations: [],
              },
            },
          })};</script>
        </html>
      `;

      const mockFn = mock(() =>
        Promise.resolve(new Response(mockHtml, { status: 200, statusText: "OK" }))
      );
      const mockFetch = createMockFetch(mockFn);

      const result = await getMostReplayed("https://www.youtube.com/watch?v=dQw4w9WgXcQ", {
        fetch: mockFetch,
      });
      expect(result).toBeNull();
      expect(mockFn).toHaveBeenCalled();
    });

    it("should throw FETCH_FAILED error when HTTP request fails", async () => {
      const mockFetch = createMockFetch(() =>
        Promise.resolve(new Response("Not Found", { status: 404, statusText: "Not Found" }))
      );

      try {
        await getMostReplayed("dQw4w9WgXcQ", { fetch: mockFetch });
        expect(true).toBe(false); // Should not reach here
      } catch (error) {
        expect(error).toBeInstanceOf(MostReplayedError);
        expect((error as MostReplayedError).code).toBe(MostReplayedErrorCode.FETCH_FAILED);
        expect((error as MostReplayedError).message).toContain("404");
      }
    });

    it("should throw FETCH_FAILED error when network error occurs", async () => {
      const mockFetch = createMockFetch(() => Promise.reject(new Error("Network error")));

      try {
        await getMostReplayed("dQw4w9WgXcQ", { fetch: mockFetch });
        expect(true).toBe(false);
      } catch (error) {
        expect(error).toBeInstanceOf(MostReplayedError);
        expect((error as MostReplayedError).code).toBe(MostReplayedErrorCode.FETCH_FAILED);
        expect((error as MostReplayedError).message).toContain("Network error");
      }
    });

    it("should throw TIMEOUT error when request times out", async () => {
      const abortError = new Error("Aborted");
      abortError.name = "AbortError";

      const mockFetch = createMockFetch(() => Promise.reject(abortError));

      try {
        await getMostReplayed("dQw4w9WgXcQ", { fetch: mockFetch, timeout: 1000 });
        expect(true).toBe(false);
      } catch (error) {
        expect(error).toBeInstanceOf(MostReplayedError);
        expect((error as MostReplayedError).code).toBe(MostReplayedErrorCode.TIMEOUT);
      }
    });

    it("should throw INVALID_VIDEO_ID error for invalid video ID", async () => {
      try {
        await getMostReplayed("invalid");
        expect(true).toBe(false);
      } catch (error) {
        expect(error).toBeInstanceOf(MostReplayedError);
        expect((error as MostReplayedError).code).toBe(MostReplayedErrorCode.INVALID_VIDEO_ID);
      }
    });

    it("should throw PARSE_FAILED error when ytInitialData is missing", async () => {
      const mockFetch = createMockFetch(() =>
        Promise.resolve(
          new Response("<html><body>No data</body></html>", { status: 200, statusText: "OK" })
        )
      );

      try {
        await getMostReplayed("dQw4w9WgXcQ", { fetch: mockFetch });
        expect(true).toBe(false);
      } catch (error) {
        expect(error).toBeInstanceOf(MostReplayedError);
        expect((error as MostReplayedError).code).toBe(MostReplayedErrorCode.PARSE_FAILED);
      }
    });

    it("should return null when timedMarkerDecorations is empty", async () => {
      const mockHtml = `
        <html>
          <script>var ytInitialData = ${JSON.stringify({
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
          })};</script>
        </html>
      `;

      const mockFetch = createMockFetch(() =>
        Promise.resolve(new Response(mockHtml, { status: 200, statusText: "OK" }))
      );

      const result = await getMostReplayed("dQw4w9WgXcQ", { fetch: mockFetch });
      expect(result).not.toBeNull();
      expect(result?.timedMarkerDecorations).toBeNull();
    });

    it("should use custom user agent when provided", async () => {
      const customUserAgent = "Custom User Agent";
      const mockHtml = `<script>var ytInitialData = {};</script>`;
      let capturedHeaders: HeadersInit | undefined;

      const mockFetch = createMockFetch((_url: string, options?: RequestInit) => {
        capturedHeaders = options?.headers;
        return Promise.resolve(new Response(mockHtml, { status: 200, statusText: "OK" }));
      });

      try {
        await getMostReplayed("dQw4w9WgXcQ", { fetch: mockFetch, userAgent: customUserAgent });
      } catch {
        // Ignore parsing errors, we're just testing headers
      }

      expect(capturedHeaders).toBeDefined();
      expect((capturedHeaders as Record<string, string>)["User-Agent"]).toBe(customUserAgent);
    });

    it("should retry on transient failures and succeed", async () => {
      let attempts = 0;
      const mockHtml = `
        <html>
          <script>var ytInitialData = ${JSON.stringify({
            frameworkUpdates: {
              entityBatchUpdate: {
                mutations: [],
              },
            },
          })};</script>
        </html>
      `;

      const mockFetch = createMockFetch(() => {
        attempts++;
        if (attempts < 3) {
          return Promise.reject(new Error("Network error"));
        }
        return Promise.resolve(new Response(mockHtml, { status: 200, statusText: "OK" }));
      });

      const result = await getMostReplayed("dQw4w9WgXcQ", {
        fetch: mockFetch,
        retries: 3,
        retryDelay: 10,
      });

      expect(result).toBeNull();
      expect(attempts).toBe(3);
    });

    it("should fail after exhausting all retries", async () => {
      let attempts = 0;

      const mockFetch = createMockFetch(() => {
        attempts++;
        return Promise.reject(new Error("Network error"));
      });

      try {
        await getMostReplayed("dQw4w9WgXcQ", {
          fetch: mockFetch,
          retries: 2,
          retryDelay: 10,
        });
        expect(true).toBe(false);
      } catch (error) {
        expect(error).toBeInstanceOf(MostReplayedError);
        expect((error as MostReplayedError).code).toBe(MostReplayedErrorCode.FETCH_FAILED);
        expect(attempts).toBe(2);
      }
    });

    it("should not retry on non-retryable errors like invalid video ID", async () => {
      try {
        await getMostReplayed("invalid", { retries: 3 });
        expect(true).toBe(false);
      } catch (error) {
        expect(error).toBeInstanceOf(MostReplayedError);
        expect((error as MostReplayedError).code).toBe(MostReplayedErrorCode.INVALID_VIDEO_ID);
      }
    });

    it("should not retry on HTTP 4xx errors", async () => {
      let attempts = 0;

      const mockFetch = createMockFetch(() => {
        attempts++;
        return Promise.resolve(new Response("Not Found", { status: 404, statusText: "Not Found" }));
      });

      try {
        await getMostReplayed("dQw4w9WgXcQ", {
          fetch: mockFetch,
          retries: 3,
          retryDelay: 10,
        });
        expect(true).toBe(false);
      } catch (error) {
        expect(error).toBeInstanceOf(MostReplayedError);
        expect(attempts).toBe(1);
      }
    });

    it("should retry on HTTP 5xx errors", async () => {
      let attempts = 0;
      const mockHtml = `
        <html>
          <script>var ytInitialData = ${JSON.stringify({
            frameworkUpdates: { entityBatchUpdate: { mutations: [] } },
          })};</script>
        </html>
      `;

      const mockFetch = createMockFetch(() => {
        attempts++;
        if (attempts < 2) {
          return Promise.resolve(
            new Response("Server Error", { status: 500, statusText: "Internal Server Error" })
          );
        }
        return Promise.resolve(new Response(mockHtml, { status: 200, statusText: "OK" }));
      });

      const result = await getMostReplayed("dQw4w9WgXcQ", {
        fetch: mockFetch,
        retries: 3,
        retryDelay: 10,
      });

      expect(result).toBeNull();
      expect(attempts).toBe(2);
    });
  });

  describe("getMostReplayedBatch", () => {
    it("should fetch multiple videos in parallel", async () => {
      const fetchedIds: string[] = [];
      const mockHtml = (id: string) => `
        <html>
          <script>var ytInitialData = ${JSON.stringify({
            frameworkUpdates: {
              entityBatchUpdate: {
                mutations: [
                  {
                    payload: {
                      macroMarkersListEntity: {
                        markersList: {
                          markers: [
                            { startMillis: "0", durationMillis: "5000", intensityScoreNormalized: 0.5 },
                          ],
                          markersDecoration: { timedMarkerDecorations: [] },
                        },
                      },
                    },
                  },
                ],
              },
            },
          })};</script>
        </html>
      `;

      const mockFetch = createMockFetch((url: string) => {
        const id = url.match(/v=([a-zA-Z0-9_-]{11})/)?.[1];
        if (id) fetchedIds.push(id);
        return Promise.resolve(new Response(mockHtml(id ?? ""), { status: 200, statusText: "OK" }));
      });

      const results = await getMostReplayedBatch(
        ["dQw4w9WgXcQ", "abc123XYZ_-", "xyz789ABC_-"],
        { fetch: mockFetch }
      );

      expect(results).toHaveLength(3);
      expect(fetchedIds).toHaveLength(3);
      expect(results.every(r => r.data !== null)).toBe(true);
      expect(results.every(r => r.error === undefined)).toBe(true);
    });

    it("should handle validation errors for invalid video IDs", async () => {
      const mockHtml = `
        <html>
          <script>var ytInitialData = ${JSON.stringify({
            frameworkUpdates: {
              entityBatchUpdate: {
                mutations: [
                  {
                    payload: {
                      macroMarkersListEntity: {
                        markersList: {
                          markers: [
                            { startMillis: "0", durationMillis: "5000", intensityScoreNormalized: 0.5 },
                          ],
                          markersDecoration: { timedMarkerDecorations: [] },
                        },
                      },
                    },
                  },
                ],
              },
            },
          })};</script>
        </html>
      `;

      const mockFetch = createMockFetch(() =>
        Promise.resolve(new Response(mockHtml, { status: 200, statusText: "OK" }))
      );

      const results = await getMostReplayedBatch(
        ["dQw4w9WgXcQ", "invalid", "abc123XYZ_-"],
        { fetch: mockFetch }
      );

      expect(results).toHaveLength(3);
      expect(results[0]?.error).toBeUndefined();
      expect(results[1]?.error).toBeDefined();
      expect(results[1]?.error?.code).toBe(MostReplayedErrorCode.INVALID_VIDEO_ID);
      expect(results[2]?.error).toBeUndefined();
    });

    it("should handle fetch errors for individual videos", async () => {
      const mockFetch = createMockFetch((url: string) => {
        const id = url.match(/v=([a-zA-Z0-9_-]{11})/)?.[1];
        if (id === "abc123XYZ_-") {
          return Promise.resolve(new Response("Not Found", { status: 404, statusText: "Not Found" }));
        }
        const mockHtml = `
          <html>
            <script>var ytInitialData = ${JSON.stringify({
              frameworkUpdates: {
                entityBatchUpdate: {
                  mutations: [
                    {
                      payload: {
                        macroMarkersListEntity: {
                          markersList: {
                            markers: [
                              { startMillis: "0", durationMillis: "5000", intensityScoreNormalized: 0.5 },
                            ],
                            markersDecoration: { timedMarkerDecorations: [] },
                          },
                        },
                      },
                    },
                  ],
                },
              },
            })};</script>
          </html>
        `;
        return Promise.resolve(new Response(mockHtml, { status: 200, statusText: "OK" }));
      });

      const results = await getMostReplayedBatch(
        ["dQw4w9WgXcQ", "abc123XYZ_-", "xyz789ABC_-"],
        { fetch: mockFetch }
      );

      expect(results).toHaveLength(3);
      expect(results[0]?.data).not.toBeNull();
      expect(results[1]?.error).toBeDefined();
      expect(results[1]?.error?.code).toBe(MostReplayedErrorCode.FETCH_FAILED);
      expect(results[2]?.data).not.toBeNull();
    });

    it("should respect concurrency limit", async () => {
      let maxConcurrent = 0;
      let currentConcurrent = 0;

      const mockFetch = createMockFetch(async () => {
        currentConcurrent++;
        maxConcurrent = Math.max(maxConcurrent, currentConcurrent);
        await new Promise(resolve => setTimeout(resolve, 50));
        currentConcurrent--;
        const mockHtml = `
          <html>
            <script>var ytInitialData = ${JSON.stringify({
              frameworkUpdates: { entityBatchUpdate: { mutations: [] } },
            })};</script>
          </html>
        `;
        return new Response(mockHtml, { status: 200, statusText: "OK" });
      });

      await getMostReplayedBatch(
        ["dQw4w9WgXcQ", "abc123XYZ_-", "xyz789ABC_-", "def456GHI_-", "jkl012MNO_-"],
        { fetch: mockFetch, concurrency: 2 }
      );

      expect(maxConcurrent).toBeLessThanOrEqual(2);
    });

    it("should return results in the same order as input", async () => {
      const mockHtml = `
        <html>
          <script>var ytInitialData = ${JSON.stringify({
            frameworkUpdates: { entityBatchUpdate: { mutations: [] } },
          })};</script>
        </html>
      `;

      const mockFetch = createMockFetch(() =>
        Promise.resolve(new Response(mockHtml, { status: 200, statusText: "OK" }))
      );

      const videoIds = ["dQw4w9WgXcQ", "abc123XYZ_-", "xyz789ABC_-"];
      const results = await getMostReplayedBatch(videoIds, { fetch: mockFetch });

      expect(results[0]?.videoId).toBe("dQw4w9WgXcQ");
      expect(results[1]?.videoId).toBe("abc123XYZ_-");
      expect(results[2]?.videoId).toBe("xyz789ABC_-");
    });

    it("should handle empty input array", async () => {
      const mockFetch = createMockFetch(() =>
        Promise.resolve(new Response("", { status: 200, statusText: "OK" }))
      );

      const results = await getMostReplayedBatch([], { fetch: mockFetch });
      expect(results).toHaveLength(0);
    });
  });
});
