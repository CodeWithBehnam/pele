import { createVideoOutro, outroLength, endHold, phoneGeometry, phoneShrinkLength } from '../lib/video-outro';
import { parse, render, type FlowchartModel, type RenderResult } from 'pele';
import { highlightLines } from '../lib/highlight';
import { videoStory } from '../lib/video-story';
import { videoThemes, type VideoTheme } from '../lib/video-themes';
import { chartMotion, type ChartModel } from '../lib/video-chart-motion';
import { gitViewport, renderGitPreview } from '../lib/video-git-preview';
import { renderFlowPreview } from '../lib/video-flow-preview';

interface Frame {
  at: number;
  chapter: number;
  source: string;
  cursor: number;
  theme: VideoTheme;
  result?: RenderResult;
}

const get = <T extends Element>(selector: string) => document.querySelector<T>(selector)!;
const film = get<HTMLElement>('.film');
const frameBox = get<HTMLElement>('.frame');
const diagram = get<HTMLElement>('.diagram');
const code = get<HTMLElement>('.source code');
const play = get<HTMLButtonElement>('#play');
const slider = get<HTMLInputElement>('#timeline');
const editor = get<HTMLTextAreaElement>('#editor');
const status = get<HTMLElement>('#status');
const frames: Frame[] = [];
const chapters: number[] = [];
const chartSources = new WeakMap<RenderResult, { source: string; model: ChartModel }>();
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const captureMode = new URLSearchParams(location.search).has('capture');
document.body.classList.toggle('capture', captureMode);
let captureTime = 0;
let captureFrame = -1;
let captureScroll = { from: 0, to: 0, at: 0 };
const scrollAt = (time: number) => {
  const t = Math.max(0, Math.min(1, (time - captureScroll.at) / 120));
  return captureScroll.from + (captureScroll.to - captureScroll.from) * (1 - (1 - t) ** 3);
};
const options = { maxWidth: 600, fontFamily: 'Inter Variable, sans-serif', idPrefix: 'film-' };
const chartOptions = (type: string) => type === 'xychart' ? { ...options, fontSize: 24 } : options;
let duration = 0;
let outroAt = Infinity;
let mobileLayout: { scale: number; height: number } | undefined;
let lastResult: RenderResult | undefined;
let completeFlow: FlowchartModel | undefined;
let gitCommitIds: Set<string> | undefined;
let gitBranches: Set<string> | undefined;
let gitBounds: ReturnType<typeof gitViewport> | undefined;

function balanced(source: string): string {
  const stack: string[] = [];
  const closers: Record<string, string> = { '[': ']', '{': '}', '(': ')' };
  let quote = false;
  for (const char of source) {
    if (char === '"') quote = !quote;
    if (quote) continue;
    if (closers[char]) stack.push(closers[char]);
    else if (char === stack.at(-1)) stack.pop();
  }
  return source + (quote ? '"' : '') + stack.reverse().join('');
}

function add(source: string, cursor: number, chapter: number, hold: number, nextCharacter = ''): void {
  const displayed = balanced(source);
  try {
    const model = parse(displayed);
    let ready = !(/[\d.]/.test(nextCharacter) && /[\d.]$/.test(source.slice(0, cursor)));
    if (model.type === 'xychart') ready &&= videoStory[chapter].steps.includes(displayed);
    const commitIds = gitCommitIds;
    const branches = gitBranches;
    if (ready) {
      const result = model.type === 'gitGraph' && commitIds && branches && gitBounds
        ? renderGitPreview(model, commitIds, branches, gitBounds)
        : model.type === 'flowchart' && completeFlow
        ? renderFlowPreview(model, completeFlow, options)
        : render(model, model.type === 'mindmap' ? { ...options, maxWidth: 900 } : chartOptions(model.type));
      if (result) {
        lastResult = result;
        if (model.type === 'pie' || model.type === 'xychart') chartSources.set(result, { source: displayed, model });
      }
    }
  } catch { /* Retain the latest valid diagram during incomplete syntax. */ }
  frames.push({ at: duration, chapter, source: displayed, cursor, theme: 'paper', result: lastResult });
  duration += hold;
}

for (const [chapter, story] of videoStory.entries()) {
  chapters.push(duration);
  lastResult = undefined;
  const complete = parse(story.steps.at(-1)!);
  completeFlow = complete.type === 'flowchart' ? complete : undefined;
  gitCommitIds = complete.type === 'gitGraph' ? new Set(complete.commits.keys()) : undefined;
  gitBranches = complete.type === 'gitGraph' ? new Set(complete.lanes) : undefined;
  gitBounds = complete.type === 'gitGraph' ? gitViewport(complete, options) : undefined;
  let source = story.steps[0];
  add(source, source.length, chapter, 400);
  for (const target of story.steps.slice(1)) {
    let prefix = 0;
    while (prefix < source.length && prefix < target.length && source[prefix] === target[prefix]) prefix++;
    let suffix = 0;
    while (suffix < source.length - prefix && suffix < target.length - prefix && source[source.length - suffix - 1] === target[target.length - suffix - 1]) suffix++;
    if (complete.type === 'xychart') {
      while (suffix && /[\d.]/.test(target[target.length - suffix])) suffix--;
    }
    const tail = suffix ? source.slice(-suffix) : '';
    if (source.length - suffix > prefix) add(source.slice(0, prefix) + tail, prefix, chapter, 0);
    for (let end = prefix + 1; end <= target.length - suffix; end++) {
      const lineStart = target.lastIndexOf('\n', end - 1) + 1;
      if (/^[\t ]*$/.test(target.slice(lineStart, end))) {
        while (end < target.length - suffix && /[\t ]/.test(target[end])) end++;
      }
      const command = complete.type === 'gitGraph' ? target.slice(lineStart).match(/^\s*(?:commit id:\s*"|checkout main)/)?.[0] : undefined;
      const delay = command && end <= lineStart + command.length ? 8 : 24;
      add(target.slice(0, end) + tail, end, chapter, delay, target[end]);
    }
    source = target;
    add(source, source.length - suffix, chapter, complete.type === 'xychart' ? 120 : 300);
  }
  for (const theme of story.themes ?? []) {
    frames.push({ at: duration, chapter, source, cursor: source.length, theme, result: lastResult });
    duration += 700;
  }
  if (complete.type === 'xychart') duration += 200;
  if (complete.type === 'mindmap') {
    duration += 450;
    outroAt = duration;
    const landscape = lastResult;
    for (let elapsed = 0; elapsed <= phoneShrinkLength; elapsed += 20) {
      const { width, layoutHeight, padding } = phoneGeometry(elapsed);
      const responsive = render(complete, { ...options, maxWidth: Math.max(340, width - 2 * padding) });
      const result = responsive.height > responsive.width ? responsive : landscape ?? responsive;
      if (!mobileLayout && result.height > result.width) {
        mobileLayout = { scale: Math.min((width - 2 * padding) / result.width, (layoutHeight - 2 * padding) / result.height, 4) * .95, height: layoutHeight - 2 * padding };
      }
      frames.push({ at: outroAt + elapsed, chapter, source, cursor: source.length, theme: 'paper', result });
    }
    duration = outroAt + outroLength;
  } else duration += 400;
}
const endAt = duration;
duration += endHold;
slider.max = String(duration / 1000);

function resize(): void {
  const bounds = frameBox.getBoundingClientRect();
  const scale = Math.max(bounds.width / 966, bounds.height / (4096 / 3));
  film.style.transform = captureMode ? 'none' : `scale(${scale})`;
  if (captureMode) film.style.zoom = String(scale);
}
new ResizeObserver(resize).observe(frameBox);
resize();

function showSource(source: string, cursor: number, animate = false): void {
  code.innerHTML = highlightLines(source.split('\n'), 'mermaid').join('\n');
  const walker = document.createTreeWalker(code, NodeFilter.SHOW_TEXT);
  let remaining = Math.min(cursor, source.length);
  const caret = document.createElement('span');
  caret.className = 'source-cursor';
  while (walker.nextNode()) {
    const text = walker.currentNode as Text;
    if (remaining <= text.length) {
      text.parentNode!.insertBefore(caret, text.splitText(remaining));
      break;
    }
    remaining -= text.length;
  }
  const lineHeight = parseFloat(getComputedStyle(code).lineHeight);
  const padding = parseFloat(getComputedStyle(code).paddingTop);
  const visibleLines = Math.round((code.parentElement!.clientHeight - padding) / lineHeight);
  const line = Math.round((caret.offsetTop - padding) / lineHeight);
  const offset = Math.max(0, line - visibleLines + 1) * lineHeight;
  code.parentElement!.classList.toggle('scrolling', offset > 0);
  if (captureMode) {
    if (!animate) captureScroll = { from: offset, to: offset, at: captureTime };
    else if (offset !== captureScroll.to) captureScroll = { from: scrollAt(captureTime), to: offset, at: captureTime };
    code.style.transition = 'none';
    code.style.transform = `translateY(${-scrollAt(captureTime)}px)`;
    return;
  }
  code.style.transition = animate && !reducedMotion ? 'transform 120ms ease-out' : 'none';
  code.style.transform = `translateY(${-offset}px)`;
}

let lastSvg = '';
let displayedChart: ChartModel | undefined;
let motion: { sample: (progress: number) => ChartModel; started: number; duration: number; target: RenderResult; template: SVGSVGElement } | undefined;
function layoutDiagram(): void {
  const svg = diagram.querySelector('svg');
  if (!svg) return;
  const box = svg.viewBox.baseVal;
  const scale = diagram.dataset.fixedScale ? Number(diagram.dataset.fixedScale) : Math.min(diagram.clientWidth / box.width, diagram.clientHeight / box.height, 4);
  svg.style.width = `${box.width * scale}px`;
  svg.style.height = `${box.height * scale}px`;
}

function paint(result: RenderResult, template?: SVGSVGElement): void {
  const next = document.createElement('div');
  next.className = 'drawing';
  next.innerHTML = result.svg;
  if (template && result.type === 'pie') {
    const svg = next.querySelector('svg')!;
    const center = template.querySelector('.pele-slices')!.getAttribute('transform')!;
    svg.setAttribute('viewBox', template.getAttribute('viewBox')!);
    svg.querySelectorAll('.pele-slices, .pele-slice-labels').forEach(group => group.setAttribute('transform', center));
    const legend = template.querySelector('.pele-legend');
    if (legend) svg.querySelector('.pele-legend')?.replaceWith(legend.cloneNode(true));
  }
  diagram.replaceChildren(next);
  layoutDiagram();
}

function draw(result: RenderResult | undefined, animate = false): void {
  if (result && result.svg !== lastSvg) {
    const chart = chartSources.get(result);
    const sample = animate && !reducedMotion && displayedChart && chart ? chartMotion(displayedChart, chart.source) : undefined;
    motion = undefined;
    if (sample) {
      const template = new DOMParser().parseFromString(result.svg, 'image/svg+xml').documentElement as unknown as SVGSVGElement;
      motion = { sample, started: captureMode ? captureTime : performance.now(), duration: result.type === 'xychart' ? 260 : 320, target: result, template };
    } else {
      displayedChart = chart?.model;
      paint(result);
    }
    lastSvg = result.svg;
  }
}

let paletteColors: Record<string, string> = { ...videoThemes.paper.colors };
let paletteTarget: VideoTheme | undefined;
let paletteMotion: { from: Record<string, string>; to: Record<string, string>; started: number } | undefined;
function paintPalette(colors: Record<string, string>): void {
  paletteColors = colors;
  for (const [token, value] of Object.entries(colors)) film.style.setProperty(`--pele-${token}`, value);
}
function advancePalette(now: number): void {
  if (!paletteMotion) return;
  const progress = Math.max(0, Math.min(1, (now - paletteMotion.started) / 380));
  const eased = progress * progress * (3 - 2 * progress);
  paintPalette(Object.fromEntries(Object.entries(paletteMotion.to).map(([token, value]) => {
    const start = paletteMotion!.from[token];
    const channels = [1, 3, 5].map(i => Math.round(parseInt(start.slice(i, i + 2), 16) * (1 - eased) + parseInt(value.slice(i, i + 2), 16) * eased));
    return [token, `#${channels.map(channel => channel.toString(16).padStart(2, '0')).join('')}`];
  })));
  if (progress === 1) paletteMotion = undefined;
}
function applyTheme(theme: VideoTheme, animate = false): void {
  if (animate && theme === paletteTarget) return;
  const now = captureMode ? captureTime : performance.now();
  advancePalette(now);
  paletteTarget = theme;
  film.dataset.palette = theme;
  if (animate && !reducedMotion) paletteMotion = { from: paletteColors, to: videoThemes[theme].colors, started: now };
  else {
    paletteMotion = undefined;
    paintPalette(videoThemes[theme].colors);
  }
  get<HTMLSelectElement>('#theme').value = theme;
}
for (const [value, palette] of Object.entries(videoThemes)) {
  const option = document.createElement('option');
  option.value = value;
  option.textContent = palette.name;
  get('#theme').append(option);
}
get('#theme').addEventListener('change', event => {
  setPlaying(false);
  applyTheme((event.target as HTMLSelectElement).value as VideoTheme, true);
});

let position = 0;
let playing = false;
let custom = false;
let shown = -1;
let lastTime = performance.now();
const clock = (ms: number) => `${Math.floor(ms / 60000)}:${String(Math.floor(ms / 1000) % 60).padStart(2, '0')}`;

const paintOutro = createVideoOutro(film, diagram, mobileLayout);
const updateOutro = (elapsed: number) => paintOutro(reducedMotion && elapsed >= 0 ? outroLength + endHold : elapsed);

function present(animate = false): void {
  const ending = !custom && position >= endAt;
  film.classList.toggle('ending', ending);
  slider.value = String(position / 1000);
  get<HTMLOutputElement>('#time').value = `${clock(position)} / ${clock(duration)}`;
  updateOutro(custom ? -Infinity : position - outroAt);
  layoutDiagram();
  if (custom || ending) return;
  let index = frames.findLastIndex(frame => frame.at <= position);
  if (index < 0) index = 0;
  if (shown === index) return;
  shown = index;
  const frame = frames[index];
  film.dataset.scene = videoStory[frame.chapter].name;
  diagram.style.left = '30px';
  diagram.style.right = '30px';
  showSource(frame.source, frame.cursor, animate && frames[index - 1]?.chapter === frame.chapter);
  applyTheme(frame.theme, animate && (frames[index - 1]?.chapter === frame.chapter || videoStory[frame.chapter].name === 'Mindmap'));
  draw(frame.result, animate);
  updateOutro(position - outroAt);
  layoutDiagram();
  editor.value = frame.source;
  status.textContent = 'Live preview';
  document.querySelectorAll<HTMLButtonElement>('.chapters button').forEach((button, i) => button.setAttribute('aria-current', String(i === frame.chapter)));
}

function setPlaying(value: boolean): void {
  playing = value;
  play.textContent = playing ? 'Pause' : 'Play';
  play.setAttribute('aria-pressed', String(playing));
  lastTime = performance.now();
}

function seek(ms: number): void {
  if (captureMode) {
    captureAt(ms);
    return;
  }
  if (motion) {
    displayedChart = chartSources.get(motion.target)?.model;
    paint(motion.target);
    motion = undefined;
  }
  custom = false;
  shown = -1;
  position = Math.max(0, Math.min(duration, ms));
  present();
}

videoStory.forEach((story, index) => {
  const button = document.createElement('button');
  button.type = 'button';
  button.textContent = story.name;
  button.addEventListener('click', () => seek(chapters[index]));
  get<HTMLElement>('.chapters').append(button);
});
play.disabled = false;
setPlaying(false);
play.addEventListener('click', () => {
  if (custom) seek(position);
  if (position >= duration) seek(0);
  setPlaying(!playing);
});
get('#restart').addEventListener('click', () => { seek(0); setPlaying(true); });
get('#reset').addEventListener('click', () => seek(position));
slider.addEventListener('input', () => { setPlaying(false); seek(Number(slider.value) * 1000); });
editor.addEventListener('input', () => {
  setPlaying(false);
  custom = true;
  updateOutro(-Infinity);
  film.classList.remove('ending');
  showSource(editor.value, editor.selectionStart);
  try {
    const model = parse(editor.value);
    const result = render(model, chartOptions(model.type));
    if (model.type === 'pie' || model.type === 'xychart') chartSources.set(result, { source: editor.value, model });
    draw(result, true);
    status.textContent = 'Live preview · edited';
  } catch (error) {
    status.textContent = error instanceof Error ? error.message : 'Incomplete syntax';
  }
});
document.addEventListener('keydown', event => {
  if ((event.target as HTMLElement).closest('input,textarea,select,button,summary')) return;
  if (event.code === 'Space') { event.preventDefault(); play.click(); }
  if (event.code === 'ArrowRight' || event.code === 'ArrowLeft') {
    event.preventDefault(); setPlaying(false); seek(position + (event.code === 'ArrowRight' ? 500 : -500));
  }
});
document.addEventListener('visibilitychange', () => { lastTime = performance.now(); });
function advanceMotion(now: number): void {
  advancePalette(now);
  if (motion) {
    const progress = Math.max(0, Math.min(1, (now - motion.started) / motion.duration));
    const eased = 1 - (1 - progress) ** 3;
    displayedChart = motion.sample(eased);
    if (progress === 1) {
      displayedChart = chartSources.get(motion.target)?.model;
      paint(motion.target);
      motion = undefined;
    } else paint(render(displayedChart, chartOptions(displayedChart.type)), motion.template);
  }
}

function captureAt(ms: number): void {
  if (ms < captureTime || captureFrame < 0) {
    captureFrame = -1;
    paletteTarget = undefined;
    paletteMotion = undefined;
    shown = -1;
    lastSvg = '';
    displayedChart = undefined;
    motion = undefined;
    captureScroll = { from: 0, to: 0, at: 0 };
  }
  while (captureFrame + 1 < frames.length && frames[captureFrame + 1].at <= ms) {
    captureTime = frames[++captureFrame].at;
    advanceMotion(captureTime);
    position = captureTime;
    present(true);
  }
  captureTime = ms;
  position = ms;
  advanceMotion(ms);
  present();
  code.style.transform = `translateY(${-scrollAt(ms)}px)`;
  film.dataset.captureTime = String(ms);
}

function tick(now: number): void {
  if (playing && !document.hidden) {
    position = Math.min(duration, position + Math.min(now - lastTime, 100) * Number(get<HTMLSelectElement>('#speed').value));
    present(true);
    if (position >= duration) setPlaying(false);
  }
  if (!document.hidden) advanceMotion(now);
  lastTime = now;
  requestAnimationFrame(tick);
}
if (captureMode) {
  slider.step = 'any';
  captureAt(0);
} else {
  present();
  requestAnimationFrame(tick);
}
