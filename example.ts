/**
 * Example usage of the yt-most-replayed library.
 *
 * Run with: bun run example.ts <VIDEO_ID_OR_URL>
 */

import {
  extractVideoId,
  filterByIntensity,
  formatTime,
  generateTimestampUrl,
  getMostReplayed,
  getSegmentAtTime,
  getTopSegments,
  MostReplayedError,
} from "./src/index.js";

async function main() {
  const input = process.argv[2];

  if (!input) {
    console.log("Usage: bun run example.ts <VIDEO_ID_OR_URL>");
    console.log("");
    console.log("Examples:");
    console.log("  bun run example.ts dQw4w9WgXcQ");
    console.log('  bun run example.ts "https://www.youtube.com/watch?v=dQw4w9WgXcQ"');
    console.log("  bun run example.ts https://youtu.be/dQw4w9WgXcQ");
    process.exit(1);
  }

  try {
    // Extract video ID from input (handles both IDs and URLs)
    const videoId = extractVideoId(input);
    console.log(`Fetching most replayed data for: ${videoId}\n`);

    // Fetch the data
    const data = await getMostReplayed(videoId);

    if (!data) {
      console.log("No most replayed data available for this video.");
      console.log("This can happen for videos with low view counts or very new videos.");
      process.exit(0);
    }

    // Display basic info
    console.log("=== Video Statistics ===");
    console.log(`  Heatmap segments: ${data.markers.length}`);
    console.log(`  Estimated duration: ${formatTime(data.videoDurationMillis)}`);
    console.log(`  Average intensity: ${(data.averageIntensity * 100).toFixed(1)}%`);

    // Display peak segment
    if (data.peakSegment) {
      console.log("");
      console.log("=== Peak Moment ===");
      console.log(`  Time: ${formatTime(data.peakSegment.startMillis)}`);
      console.log(`  Intensity: ${(data.peakSegment.intensityScoreNormalized * 100).toFixed(1)}%`);
      console.log(`  URL: ${generateTimestampUrl(videoId, data.peakSegment.startMillis)}`);
    }

    // Display top 5 segments
    console.log("");
    console.log("=== Top 5 Most Replayed Moments ===");
    const top5 = getTopSegments(data, 5);
    top5.forEach((segment, i) => {
      const url = generateTimestampUrl(videoId, segment.startMillis);
      console.log(
        `  ${i + 1}. ${formatTime(segment.startMillis)} - ${(segment.intensityScoreNormalized * 100).toFixed(1)}%`
      );
      console.log(`     ${url}`);
    });

    // Display hot segments (above 50% intensity)
    const hotSegments = filterByIntensity(data, 0.5);
    if (hotSegments.length > 0) {
      console.log("");
      console.log(`=== Hot Segments (>50% intensity): ${hotSegments.length} ===`);
      hotSegments.slice(0, 5).forEach((segment) => {
        console.log(
          `  ${formatTime(segment.startMillis)} - ${(segment.intensityScoreNormalized * 100).toFixed(1)}%`
        );
      });
      if (hotSegments.length > 5) {
        console.log(`  ... and ${hotSegments.length - 5} more`);
      }
    }

    // Example: Get segment at a specific time (1 minute)
    const segmentAt1Min = getSegmentAtTime(data, 60000);
    if (segmentAt1Min) {
      console.log("");
      console.log("=== Segment at 1:00 ===");
      console.log(`  Intensity: ${(segmentAt1Min.intensityScoreNormalized * 100).toFixed(1)}%`);
    }

    // Display timed marker decorations if available
    if (data.timedMarkerDecorations && data.timedMarkerDecorations.length > 0) {
      console.log("");
      console.log(`=== Timed Markers: ${data.timedMarkerDecorations.length} ===`);
      data.timedMarkerDecorations.slice(0, 5).forEach((decoration) => {
        console.log(
          `  ${formatTime(decoration.visibleTimeRangeStartMillis)} - ${formatTime(decoration.visibleTimeRangeEndMillis)}`
        );
      });
    }
  } catch (error) {
    if (error instanceof MostReplayedError) {
      console.error(`Error [${error.code}]: ${error.message}`);
      process.exit(1);
    }
    throw error;
  }
}

main();
