import { build } from 'esbuild';
import { createRequire } from 'node:module';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('../../', import.meta.url));
const require = createRequire(new URL('../package.json', import.meta.url));
const sharp = createRequire(require.resolve('astro/package.json'))('sharp');
const output = path.resolve(process.env.OUTPUT_DIR || path.join(root, 'website/outputs/showcase-v2'));
const width = 2898;
const height = 4096;
const fps = 30;
const pageWidth = width / 3;
const pageHeight = height / 3;
const selection = [
  ['flowchart', 1], ['sequence', 0], ['mindmap', 0], ['gantt', 1],
  ['git', 0], ['pie', 0], ['class', 0], ['er', 1],
  ['state', 0], ['timeline', 0], ['sankey', 0], ['xychart', 0],
  ['quadrant', 0], ['kanban', 1], ['block', 1], ['requirement', 0],
  ['journey', 0], ['architecture', 1], ['radar', 0], ['swimlane', 0],
  ['treemap', 0], ['venn', 0], ['eventmodeling', 0], ['usecase', 1],
];
const colors = ['#af3029', '#bc5215', '#ad8301', '#66800b', '#24837b', '#205ea6', '#5e409d', '#a02f6f'];
const theme = {
  '--pele-bg': '#fffcf0', '--pele-fg': '#100f0f', '--pele-muted': '#6f6e69',
  '--pele-line': '#100f0f', '--pele-surface': '#f2f0e5', '--pele-surface-alt': '#e6e4d9',
  '--pele-border': '#cecdc3', '--pele-accent': '#205ea6', '--pele-critical': '#af3029',
  '--pele-radius': '6px', '--pele-font': 'Arial', '--pele-font-mono': 'Menlo',
  '--_bg': '#fffcf0', '--_fg': '#100f0f', '--_m': '#6f6e69', '--_l': '#100f0f',
  '--_s': '#f2f0e5', '--_a': '#e6e4d9', '--_b': '#cecdc3', '--_c': '#205ea6',
  '--_r': '6px', '--_fm': 'Menlo',
  ...Object.fromEntries(colors.map((color, i) => [`--pele-series-${i + 1}`, color])),
};
const escape = text => text.replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[char]);
const resolveTheme = svg => {
  const rootStyle = svg.match(/^<svg[^>]*style="([^"]*)"/)?.[1] ?? '';
  const tokens = { ...theme, ...Object.fromEntries([...rootStyle.matchAll(/(--[\w-]+):([^;]+)/g)].map(match => [match[1], match[2]])) };
  while (svg.includes('var(')) {
    const next = svg.replace(/var\((--[\w-]+)(?:,([^()]*))?\)/g, (_, key, fallback) => {
      if (tokens[key] !== undefined) return tokens[key];
      if (fallback !== undefined) return fallback;
      throw new Error(`Unresolved SVG token: ${key}`);
    });
    if (next === svg) throw new Error('Unable to resolve SVG theme');
    svg = next;
  }
  return svg;
};
const shell = content => `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${pageWidth} ${pageHeight}"><rect width="100%" height="100%" fill="#fffcf0"/><g font-family="Arial,sans-serif" fill="#100f0f">${content}</g></svg>`;

await mkdir(output, { recursive: true });
await build({
  stdin: { contents: "export {render} from './src/index.ts'; export {exampleGroups} from './website/src/lib/examples.ts'; export {siteIcon} from './website/src/lib/icons.ts';", resolveDir: root },
  bundle: true, platform: 'node', format: 'esm', outfile: path.join(output, 'runtime.mjs'),
});
const { render, exampleGroups, siteIcon } = await import(pathToFileURL(path.join(output, 'runtime.mjs')));
const corpora = {};
for (const file of await readdir(path.join(root, 'tests/corpus'))) {
  if (file.endsWith('-docs.json')) corpora[file] = JSON.parse(await readFile(path.join(root, 'tests/corpus', file), 'utf8'));
}
const groups = exampleGroups(corpora, source => { try { return render(source).svg; } catch { return undefined; } });
const frames = [];
const previews = [];
const renderOptions = { maxWidth: 560, fontFamily: 'Arial', fontFamilyMono: 'Menlo', icons: siteIcon, now: new Date('2026-10-16T12:00:00Z') };
const placeDiagram = (diagram, box, zoom = 1) => {
  const scale = Math.min(box.width / diagram.width, box.height / diagram.height) * zoom;
  const x = box.x + (box.width - diagram.width * scale) / 2;
  const y = box.y + (box.height - diagram.height * scale) / 2;
  return resolveTheme(diagram.svg).replace('<svg ', `<svg x="${x}" y="${y}" `)
    .replace(/width="[^"]+" height="[^"]+"/, `width="${diagram.width * scale}" height="${diagram.height * scale}"`)
    .replace('max-width:100%;height:auto;', '');
};
const save = async (name, svg, frameCount, metadata = {}) => {
  await sharp(Buffer.from(svg)).png().toFile(path.join(output, `${name}.png`));
  frames.push({ name, duration: frameCount / fps, ...metadata });
};
const introLines = ['  A --> B[Build]', '  B --> C[Ship]', '  C --> D[Learn]', '  D --> A'];
let source = 'flowchart TD\n  A[Idea]';
let lastDiagram = render(source, renderOptions);
let introIndex = 0;
const introFrame = async (raw, hold = 1) => {
  // Match an editor's automatic closing bracket while the label is being typed.
  const code = raw + (raw.lastIndexOf('[') > raw.lastIndexOf(']') ? ']' : '');
  let renderedSource;
  try {
    lastDiagram = render(code, { ...renderOptions, idPrefix: 'typing-' });
    renderedSource = code;
  } catch {
    // Incomplete arrows keep the most recent valid diagram, as a live editor would.
  }
  const lines = code.split('\n');
  const currentLine = raw.split('\n').at(-1);
  const cursorX = 48 + currentLine.length * 20.47;
  const cursorY = 90 + (lines.length - 1) * 47;
  const codeSvg = lines.map((line, i) => `<text x="48" y="${90 + i * 47}" xml:space="preserve" font-size="34" font-family="Menlo,monospace" fill="${i === 0 ? '#205ea6' : '#100f0f'}">${escape(line)}</text>`).join('');
  const introScale = Math.min(870 / lastDiagram.width, 900 / lastDiagram.height, 4.5);
  const chartX = (pageWidth - lastDiagram.width * introScale) / 2;
  const chartY = 420 + (900 - lastDiagram.height * introScale) / 2;
  const chart = resolveTheme(lastDiagram.svg).replace('<svg ', `<svg x="${chartX}" y="${chartY}" `)
    .replace(/width="[^"]+" height="[^"]+"/, `width="${lastDiagram.width * introScale}" height="${lastDiagram.height * introScale}"`)
    .replace('max-width:100%;height:auto;', '');
  const name = `typing-${String(introIndex++).padStart(3, '0')}`;
  await save(name, shell(`${codeSvg}<rect x="${cursorX}" y="${cursorY - 32}" width="3" height="39" fill="#da702c"/>${chart}`), hold, { source: code, renderedSource });
  return name;
};
previews.push(await introFrame(source, 9));
for (const line of introLines) {
  source += '\n';
  for (const character of line) {
    source += character;
    await introFrame(source);
  }
  previews.push(await introFrame(source, 6));
}
await introFrame(source, 21);
console.log('Rendered typing sequence with live diagram updates.');
for (const [index, [type, variant]] of selection.entries()) {
  const group = groups.find(group => group.type === type);
  const example = group?.sources[variant];
  if (!example) throw new Error(`Missing example: ${type}/${variant}`);
  const diagram = render(example, { ...renderOptions, idPrefix: `video-${index}-` });
  const name = `${String(index + 1).padStart(2, '0')}-${type}`;
  const box = { x: 30, y: 35, width: pageWidth - 60, height: pageHeight - 70 };
  for (let step = 0; step < 6; step++) {
    const progress = step / 5;
    const zoom = 0.94 + 0.06 * (1 - (1 - progress) ** 3);
    const svg = shell(placeDiagram(diagram, box, zoom));
    const frameName = `${name}-${step}`;
    await save(frameName, svg, step === 5 ? 15 : 1, { type, variant, source: example });
    if (step === 5) {
      previews.push(frameName);
      await writeFile(path.join(output, `${name}.svg`), svg);
    }
  }
}
const endCard = await readFile(new URL('./end-card.png', import.meta.url));
const endMetadata = await sharp(endCard).metadata();
if (endMetadata.width !== width || endMetadata.height !== height) throw new Error('End card must match video dimensions');
await writeFile(path.join(output, 'end.png'), endCard);
frames.push({ name: 'end', duration: 2 });
previews.push('end');
const thumbWidth = 242;
const thumbHeight = 342;
const thumbs = await Promise.all(previews.map(async (name, i) => ({ input: await sharp(path.join(output, `${name}.png`)).resize(thumbWidth, thumbHeight).png().toBuffer(), left: (i % 5) * thumbWidth, top: Math.floor(i / 5) * thumbHeight })));
await sharp({ create: { width: thumbWidth * 5, height: thumbHeight * Math.ceil(previews.length / 5), channels: 3, background: '#fffcf0' } }).composite(thumbs).png().toFile(path.join(output, 'contact-sheet.png'));
const duration = frames.reduce((sum, frame) => sum + frame.duration, 0);
await writeFile(path.join(output, 'render-info.json'), JSON.stringify({ width, height, fps, duration, frames }, null, 2));
const concat = frames.map(frame => `file '${frame.name}.png'\noption framerate ${fps}\nduration ${frame.duration}`).join('\n') + `\nfile 'end.png'\noption framerate ${fps}\n`;
await writeFile(path.join(output, 'frames.txt'), concat);
console.log(`Saved ${frames.length} preview frames to ${output}`);
if (!process.argv.includes('--preview')) {
  const encode = (filename, filter, preset, crf) => new Promise((resolve, reject) => {
    const process = spawn('ffmpeg', ['-y', '-loglevel', 'warning', '-f', 'concat', '-safe', '0', '-i', path.join(output, 'frames.txt'), '-vf', `${filter},fps=${fps}`, '-t', String(duration), '-an', '-c:v', 'libx264', '-preset', preset, '-crf', crf, '-pix_fmt', 'yuv420p', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-colorspace', 'bt709', '-movflags', '+faststart', path.join(output, filename)], { stdio: 'inherit' });
    process.on('error', reject);
    process.on('close', code => code === 0 ? resolve() : reject(new Error(`ffmpeg exited with ${code}`)));
  });
  await encode('pele-showcase-preview.mp4', 'scale=966:-2:out_color_matrix=bt709', 'fast', '18');
  console.log('Encoded portrait preview.');
  await encode('pele-showcase-2898x4096.mp4', 'scale=iw:ih:out_color_matrix=bt709', 'fast', '18');
  console.log('Encoded full-resolution portrait master.');
}
