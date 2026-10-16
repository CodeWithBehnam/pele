import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

const directory = process.argv[2] ?? 'website/outputs/showcase-live-v2';
const info = JSON.parse(readFileSync(join(directory, 'render-info.json'), 'utf8'));
const width = 120;
const height = 170;
const stride = width * height * 3;
const input = process.argv[3] ? ['-i', process.argv[3]] : ['-framerate', String(info.fps), '-i', join(directory, 'frames/%05d.jpg')];
const decoded = spawnSync('ffmpeg', ['-v', 'error', ...input, '-vf', `scale=${width}:${height}`,
  '-pix_fmt', 'rgb24', '-f', 'rawvideo', '-'], { maxBuffer: info.frames * stride + 1024 * 1024 });
if (decoded.error) throw decoded.error;
if (decoded.status !== 0) throw new Error(decoded.stderr.toString());
if (decoded.stdout.length !== info.frames * stride) throw new Error('Unexpected frame count');
const dark = (frame, pixel) => {
  const offset = frame * stride + pixel * 3;
  return Math.max(...decoded.stdout.subarray(offset, offset + 3)) < 25;
};
const lightness = (frame, pixel) => {
  const offset = frame * stride + pixel * 3;
  return (decoded.stdout[offset] + decoded.stdout[offset + 1] + decoded.stdout[offset + 2]) / 3;
};
const bad = [];
for (let frame = 0; frame < info.frames; frame++) {
  let bandRows = 0;
  if (frame / info.fps < info.outroAt) {
    for (let y = 1; y < height - 1; y++) {
      let count = 0;
      for (let x = 1; x < width - 1; x++) if (dark(frame, y * width + x)) count++;
      if (count > width * .95) bandRows++;
    }
  }
  let flashPixels = 0;
  let lightFlashPixels = 0;
  if (frame > 0 && frame < info.frames - 1) {
    for (let pixel = 0; pixel < width * height; pixel++) {
      if (dark(frame, pixel) && !dark(frame - 1, pixel) && !dark(frame + 1, pixel)) flashPixels++;
      const value = lightness(frame, pixel);
      if (value > lightness(frame - 1, pixel) + 45 && value > lightness(frame + 1, pixel) + 45) lightFlashPixels++;
    }
  }
  if (bandRows > 1 || flashPixels > 120 || lightFlashPixels > 120) bad.push({ frame, bandRows, flashPixels, lightFlashPixels });
}
const report = { frames: info.frames, bad };
writeFileSync(join(directory, process.argv[3] ? 'video-check.json' : 'capture-check.json'), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report));
if (bad.length) process.exitCode = 1;
