# @reckerp/yt-most-replayed

A TypeScript library to fetch YouTube's "Most Replayed" heatmap data.

## Installation

```bash
bun add @reckerp/yt-most-replayed
```

```bash
npm install @reckerp/yt-most-replayed
```

```bash
pnpm add @reckerp/yt-most-replayed
```

## Usage

### Basic Example

```typescript
import { getMostReplayed, formatTime } from "@reckerp/yt-most-replayed";

const data = await getMostReplayed("dQw4w9WgXcQ");

if (data) {
  console.log(`Video has ${data.markers.length} heatmap segments`);
  console.log(`Peak moment at ${formatTime(data.peakSegment?.startMillis ?? 0)}`);
  console.log(`Average intensity: ${(data.averageIntensity * 100).toFixed(1)}%`);
} else {
  console.log("No most replayed data available");
}
```

### Using URLs

```typescript
import { getMostReplayed } from "@reckerp/yt-most-replayed";

// All these formats work:
await getMostReplayed("dQw4w9WgXcQ");
await getMostReplayed("https://www.youtube.com/watch?v=dQw4w9WgXcQ");
await getMostReplayed("https://youtu.be/dQw4w9WgXcQ");
await getMostReplayed("https://www.youtube.com/shorts/VIDEO_ID");
```

### Finding Top Moments

```typescript
import {
  getMostReplayed,
  getTopSegments,
  formatTime,
  generateTimestampUrl,
} from "@reckerp/yt-most-replayed";

const data = await getMostReplayed("dQw4w9WgXcQ");

if (data) {
  const top5 = getTopSegments(data, 5);
  
  top5.forEach((segment, i) => {
    console.log(`#${i + 1}: ${formatTime(segment.startMillis)}`);
    console.log(`    Intensity: ${(segment.intensityScoreNormalized * 100).toFixed(1)}%`);
    console.log(`    URL: ${generateTimestampUrl("dQw4w9WgXcQ", segment.startMillis)}`);
  });
}
```

### Filtering by Intensity

```typescript
import { getMostReplayed, filterByIntensity } from "@reckerp/yt-most-replayed";

const data = await getMostReplayed("dQw4w9WgXcQ");

if (data) {
  // Get only "hot" segments (above 50% intensity)
  const hotSegments = filterByIntensity(data, 0.5);
  console.log(`Found ${hotSegments.length} hot segments`);
}
```

### Error Handling

```typescript
import {
  getMostReplayed,
  MostReplayedError,
  MostReplayedErrorCode,
} from "@reckerp/yt-most-replayed";

try {
  const data = await getMostReplayed("invalid-id");
} catch (error) {
  if (error instanceof MostReplayedError) {
    switch (error.code) {
      case MostReplayedErrorCode.INVALID_VIDEO_ID:
        console.error("Invalid video ID or URL");
        break;
      case MostReplayedErrorCode.FETCH_FAILED:
        console.error("Failed to fetch video page");
        break;
      case MostReplayedErrorCode.PARSE_FAILED:
        console.error("Failed to parse video data");
        break;
      case MostReplayedErrorCode.TIMEOUT:
        console.error("Request timed out");
        break;
    }
  }
}
```

### Custom Fetch Options

```typescript
import { getMostReplayed } from "@reckerp/yt-most-replayed";

const data = await getMostReplayed("dQw4w9WgXcQ", {
  timeout: 15000, // 15 second timeout
  userAgent: "MyApp/1.0",
});
```

## API Reference

### `getMostReplayed(videoIdOrUrl, options?)`

Fetches the most replayed data for a YouTube video.

**Parameters:**
- `videoIdOrUrl` (string) - A YouTube video ID or URL
- `options` (FetchOptions) - Optional configuration
  - `timeout` (number) - Request timeout in ms (default: 10000)
  - `userAgent` (string) - Custom user agent
  - `fetch` (function) - Custom fetch implementation

**Returns:** `Promise<MostReplayedData | null>`

### `MostReplayedData`

```typescript
interface MostReplayedData {
  markers: HeatmapMarker[];           // Heatmap segments
  timedMarkerDecorations: TimedMarkerDecoration[] | null;
  videoDurationMillis: number;        // Estimated video duration
  peakSegment: HeatmapMarker | null;  // Highest intensity segment
  averageIntensity: number;           // Average intensity (0-1)
}

interface HeatmapMarker {
  startMillis: number;                // Start time in milliseconds
  intensityScoreNormalized: number;   // Intensity (0-1)
}
```

### Utility Functions

| Function | Description |
|----------|-------------|
| `formatTime(millis)` | Format milliseconds as "MM:SS" or "HH:MM:SS" |
| `getTopSegments(data, count)` | Get N most replayed segments |
| `getSegmentAtTime(data, millis)` | Find segment at specific time |
| `filterByIntensity(data, threshold)` | Filter segments by intensity |
| `generateTimestampUrl(videoId, millis)` | Generate YouTube URL with timestamp |
| `isValidVideoId(id)` | Check if string is valid video ID |
| `extractVideoId(urlOrId)` | Extract video ID from URL or validate ID |

## Running the Example

```bash
bun run example.ts dQw4w9WgXcQ
```

## Development

```bash
# Install dependencies
bun install

# Run type checking
bun run typecheck

# Build the library
bun run build

# Format and lint
bun run format
bun run lint
```

## License

MIT
