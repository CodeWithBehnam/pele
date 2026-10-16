import { render, type GitModel, type RenderOptions, type RenderResult } from 'pele';
import { defaultMeasurer } from '../../../src/text/measurer';

const escapeText = (text: string) => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function gitSvg(result: RenderResult): SVGSVGElement {
  return new DOMParser().parseFromString(result.svg, 'image/svg+xml').documentElement as unknown as SVGSVGElement;
}

function mainPosition(svg: SVGSVGElement): DOMPoint {
  const lane = svg.querySelector<SVGPathElement>('.pele-branch[data-id="main"] .pele-lane')!;
  let point = lane.getPointAtLength(0);
  for (let element: SVGElement | null = lane; element && element !== svg; element = element.parentElement as unknown as SVGElement | null) {
    const transform = (element as SVGGraphicsElement).transform?.baseVal.consolidate();
    if (transform) point = point.matrixTransform(transform.matrix);
  }
  return point;
}

export function gitViewport(model: GitModel, options: RenderOptions) {
  const measurer = options.measurer ?? defaultMeasurer(options.fontFamily, options.fontFamilyMono);
  const labels = new Map([...model.commits.values()].map(commit => [commit.id,
    [...model.commits.values()].filter(other => other.branch === commit.branch).map(other => other.id)]));
  const reserved: RenderOptions = { ...options, measurer: {
    width(text, size, style) {
      return Math.max(...(labels.get(text) ?? [text]).map(label => measurer.width(label, size, style)));
    },
  } };
  const result = render(model, reserved);
  return { width: result.width, height: result.height, main: mainPosition(gitSvg(result)), options: reserved };
}

export function renderGitPreview(model: GitModel, commitIds: ReadonlySet<string>, branches: ReadonlySet<string>, viewport: ReturnType<typeof gitViewport>): RenderResult | undefined {
  const resolve = (value: string, names: ReadonlySet<string>): string | undefined => {
    if (names.has(value)) return value;
    const matches = [...names].filter(name => name.startsWith(value));
    return matches.length === 1 ? matches[0] : undefined;
  };
  const ids = new Map<string, string>();
  const lanes = new Map<string, string>();
  const reveals = new Map<string, { visible: string; hidden: string }>();
  for (const [values, names, mapping] of [[model.commits.keys(), commitIds, ids], [model.lanes, branches, lanes]] as const) {
    for (const value of values) {
      const full = resolve(value, names);
      if (!full) return;
      mapping.set(value, full);
      if (full !== value) reveals.set(escapeText(full), { visible: escapeText(value), hidden: escapeText(full.slice(value.length)) });
    }
  }
  model.commits = new Map([...model.commits.values()].map(commit => {
    commit.id = ids.get(commit.id)!;
    commit.parents = commit.parents.map(id => ids.get(id)!);
    commit.branch = lanes.get(commit.branch)!;
    return [commit.id, commit];
  }));
  model.lanes = model.lanes.map(lane => lanes.get(lane)!);
  model.branches = new Map([...model.branches].map(([branch, head]) => [lanes.get(branch)!, head === null ? null : ids.get(head)!]));
  model.currentBranch = lanes.get(model.currentBranch)!;
  const result = render(model, viewport.options);
  // Hidden suffixes still occupy SVG text space, preserving the full label's alignment.
  result.svg = result.svg.replace(/(<text\b[^>]*>)([^<]*)(<\/text>)/g, (text, open, label, close) => {
    const reveal = reveals.get(label);
    return reveal ? `${open}${reveal.visible}<tspan visibility="hidden" aria-hidden="true">${reveal.hidden}</tspan>${close}` : text;
  });
  const svg = gitSvg(result);
  // Reserve the completed scene's scale and align every frame to its main lane.
  const main = mainPosition(svg);
  svg.setAttribute('viewBox', `${main.x - viewport.main.x} ${main.y - viewport.main.y} ${viewport.width} ${viewport.height}`);
  result.svg = new XMLSerializer().serializeToString(svg);
  result.width = viewport.width;
  result.height = viewport.height;
  return result;
}
