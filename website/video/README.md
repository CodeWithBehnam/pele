# Pele social video

## Preview and edit

Open `/video` on the website dev server (currently `http://localhost:4322/video`). The unlinked page shows Flow → XY → Git → Pie → Mindmap, followed by the Pele logo. Use the timeline and syntax editor to iterate without rendering video.

Paper Mono must be installed locally. The video is silent, portrait, and 30fps.

| File | Purpose |
| --- | --- |
| `website/src/lib/video-story.ts` | Examples and scene order |
| `website/src/scripts/video-prototype.ts` | Playback, typing, and capture |
| `website/src/lib/video-outro.ts` | Phone collapse and logo reveal |
| `website/src/lib/video-themes.ts` | Color palettes |
| `website/src/pages/video.astro` | Layout and controls |

`render.mjs` is the older montage renderer; it does not export the current prototype.

## Capture

1. Open `/video?capture` with a 2898 × 4096 browser viewport and wait for fonts to load. Capture mode hides controls and samples animations at the selected time.
2. Read the duration from `#timeline.max`. For each frame from `0` through `ceil(duration * 30) - 1`, set the timeline to `String(Math.round(frame * 1000 / 30) / 1000)` seconds.
3. Save full-page screenshots as `frames/00000.jpg`, etc. In-app browser screenshots contain JPEG bytes. Take repeated screenshots until two consecutive buffers match, with bounded retries. If they do not settle, inspect decoded pixel differences before accepting the frame.
4. Save `render-info.json` with `fps`, `frames`, and `outroAt` (seconds). The current outro starts at 22.026s; update this when story timing changes.
5. Restore the browser viewport afterward.

Exports belong in ignored `website/outputs/`. The latest is `showcase-live-v4`: 864 frames, 28.8 seconds.

## Check and encode

Run from the repository root, substituting your output directory:

```sh
node website/video/check-capture.mjs website/outputs/showcase-live-v4
```

The checker flags black bands and isolated dark/light flashes. Inspect flagged frames and recapture at their exact timestamps; normal diagram movement can also trigger it. Successful decoding alone does not rule out screenshot artifacts.

Encode a sharing copy:

```sh
ffmpeg -framerate 30 -i website/outputs/showcase-live-v4/frames/%05d.jpg \
  -vf 'scale=1448:2048:in_range=full:out_range=tv,format=yuv420p' \
  -c:v libx264 -profile:v high -level:v 5.0 -preset fast -crf 18 \
  -color_range tv -movflags +faststart \
  website/outputs/showcase-live-v4/pele-showcase-social.mp4
```

Check the encoded file too:

```sh
node website/video/check-capture.mjs website/outputs/showcase-live-v4 \
  website/outputs/showcase-live-v4/pele-showcase-social.mp4
```

A 2898 × 4096 H.264 master requires Level 6. The user reported playback corruption despite clean software decoding; prefer the smaller sharing copy. V4 check reports and reviewed exceptions are saved beside the videos.
