import { describe, expect, it } from 'vitest';
import { PeleError, parse, render, supports } from '../../src/index.js';
import type { MindmapModel } from '../../src/index.js';
import { metricsMeasurer } from '../../src/text/measurer.js';
import { random } from '../support/corpus.js';

const options = { measurer: metricsMeasurer };

interface Box {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

// Every node here is drawn as a rectangle, so its group and rect give its bounding box.
function boxes(svg: string): Box[] {
  const re = /<g class="pele-node[^"]*" data-id="([^"]*)" transform="translate\(([-\d.]+),([-\d.]+)\)"><rect x="[-\d.]+" y="[-\d.]+" width="([\d.]+)" height="([\d.]+)"/g;
  return [...svg.matchAll(re)].map((m) => ({ id: m[1], x: +m[2], y: +m[3], w: +m[4], h: +m[5] }));
}

function model(src: string): MindmapModel {
  return parse(src) as MindmapModel;
}

describe('mindmap rendering', () => {
  it('draws a node per line and a link per child', () => {
    const { svg, type, links } = render('mindmap\n  root((Center))\n    A\n      A1\n      A2\n    B', options);
    expect(type).toBe('mindmap');
    expect(supports('mindmap\n  root')).toBe(true);
    expect(links).toEqual([]);
    expect(svg.match(/class="pele-node/g)?.length).toBe(5);
    expect(svg.match(/class="pele-edge"/g)?.length).toBe(4);
    for (const text of ['Center', 'A', 'A1', 'A2', 'B']) expect(svg).toContain(`>${text}</text>`);
    expect(svg).toContain('data-id="root"');
  });

  it('maps each pair of delimiters to its shape', () => {
    const { svg } = render(
      'mindmap\n  root\n    a[Square]\n    b(Rounded)\n    c((Circle))\n    d))Bang((\n    e)Cloud(\n    f{{Hexagon}}\n    Plain',
      options
    );
    for (const shape of ['stadium pele-root', 'rect', 'rounded', 'circle', 'bang', 'cloud', 'hex', 'text']) {
      expect(svg, shape).toContain(`class="pele-node pele-shape-${shape}"`);
    }
    const nodes = model('mindmap\n  root\n    a[x)\n    b(x]\n    c(-x-)\n    -)x(-').nodes;
    expect(nodes.map((node) => node.type)).toEqual([0, 2, 4, 0, 0]);
  });

  it('colors each first-level branch and keeps the root neutral', () => {
    const { svg } = render('mindmap\n  [root]\n    [a]\n      [a1]\n    [b]\n    [c]', options);
    expect(svg).toMatch(/pele-root" data-id="root"[^>]*><rect[^>]*stroke="var\(--_b\)"/);
    expect(svg).toMatch(/class="pele-branch pele-section-0"><g class="pele-edges" fill="none" stroke="var\(--pele-series-1,/);
    // A shaped node is filled with a tint of its branch's color, as a pill is, and outlined in that color.
    expect(svg).toMatch(/data-id="a1"[^>]*><rect[^>]*fill="var\(--pele-series-1,[^"]*\)" fill-opacity="0.22" stroke="var\(--pele-series-1,/);
    expect(svg).toMatch(/data-id="b"[^>]*><rect[^>]*fill="var\(--pele-series-2,[^"]*\)" fill-opacity="0.22" stroke="var\(--pele-series-2,/);
    expect(svg).toMatch(/data-id="c"[^>]*><rect[^>]*fill="var\(--pele-series-3,[^"]*\)" fill-opacity="0.22" stroke="var\(--pele-series-3,/);
    // So is a pill, which the source gave no shape.
    expect(render('mindmap\n  root\n    a\n      b', options).svg).toMatch(/pele-shape-branch" data-id="a"[^>]*><rect[^>]*fill-opacity="0.22" stroke="var\(--pele-series-1,/);
  });

  it('wraps section numbers after eleven branches, as Mermaid does', () => {
    const src = 'mindmap\n  root\n' + Array.from({ length: 13 }, (_, i) => `    b${i}\n      leaf${i}\n`).join('');
    const nodes = model(src).nodes;
    expect(nodes.find((node) => node.nodeId === 'b10')?.section).toBe(10);
    expect(nodes.find((node) => node.nodeId === 'b11')?.section).toBe(0);
    expect(nodes.find((node) => node.nodeId === 'leaf12')?.section).toBe(1);
    expect(nodes[0].section).toBeUndefined();
  });

  it('puts branches on both sides of the root, balanced by height', () => {
    const src = 'mindmap\n  [root]\n    [a]\n      [a1]\n      [a2]\n      [a3]\n    [b]\n    [c]\n    [d]';
    const all = boxes(render(src, options).svg);
    const at = (id: string): Box => all.find((box) => box.id === id)!;
    expect(at('a').x).toBeGreaterThan(at('root').x);
    expect(at('a1').x).toBeGreaterThan(at('a').x);
    for (const id of ['b', 'c', 'd']) expect(at(id).x).toBeLessThan(at('root').x);
    expect(at('a1').y).toBeLessThan(at('a2').y);
    expect(at('a2').y).toBeCloseTo(at('a').y, 1);
    expect(at('b').y).toBeLessThan(at('c').y);
    expect(at('c').y).toBeCloseTo(at('root').y, 1);

    const single = boxes(render('mindmap\n  [root]\n    [a]\n      [b]', options).svg);
    expect(single.map((box) => box.id)).toEqual(['a', 'b', 'root']);
    expect(single[2].x).toBeLessThan(single[0].x);
    expect(single[0].x).toBeLessThan(single[1].x);
  });

  it('keeps branch sides when a growing final branch reaches a balanced tie', () => {
    const start = 'mindmap\n  [root]\n    [Build]\n      [Prototype]\n      [Iterate]\n    [Review]\n      [Test]\n      [Refine]';
    for (const tail of ['', '\n    [Ship]', '\n    [Ship]\n      [Launch]', '\n    [Ship]\n      [Launch]\n      [Learn]']) {
      const all = boxes(render(start + tail, options).svg);
      const x = (id: string): number => all.find(box => box.id === id)!.x;
      expect(x('Build')).toBeGreaterThan(x('root'));
      expect(x('Review')).toBeLessThan(x('root'));
      if (tail) expect(x('Ship')).toBeLessThan(x('root'));
    }
  });

  it('never overlaps nodes', () => {
    const rnd = random(11);
    for (let round = 0; round < 30; round++) {
      let src = 'mindmap\n[n0]\n';
      let depth = 1;
      const count = 2 + Math.floor(rnd() * 60);
      for (let i = 1; i < count; i++) {
        depth = Math.max(1, Math.min(depth + 1, 1 + Math.floor(rnd() * (depth + 1))));
        const label = 'word '.repeat(1 + Math.floor(rnd() * 12)).trim();
        src += `${' '.repeat(depth)}n${i}[${label}]\n`;
      }
      const all = boxes(render(src, options).svg);
      expect(all.length).toBe(count);
      for (let i = 0; i < all.length; i++) {
        for (let j = i + 1; j < all.length; j++) {
          const a = all[i];
          const b = all[j];
          const apart = Math.abs(a.x - b.x) >= (a.w + b.w) / 2 || Math.abs(a.y - b.y) >= (a.h + b.h) / 2;
          expect(apart, `${a.id} and ${b.id} in ${JSON.stringify(src)}`).toBe(true);
        }
      }
    }
  });

  it('follows Mermaid on unclear indentation', () => {
    const nodes = model('mindmap\nRoot\n    A\n        B\n      C\n   D').nodes;
    const a = nodes[1];
    expect(a.children.map((node) => node.nodeId)).toEqual(['B', 'C']);
    expect(nodes[0].children.map((node) => node.nodeId)).toEqual(['A', 'D']);
    expect(nodes.map((node) => node.level)).toEqual([0, 4, 8, 6, 3]);
  });

  it('rejects a second root with Mermaid\'s message', () => {
    const second = (): unknown => render('mindmap\n  root\n  other', options);
    expect(second).toThrow(PeleError);
    expect(second).toThrow('There can be only one root. No parent could be found for ("other")');
    expect(() => render('mindmap\n    root\n  shallower', options)).toThrow(/only one root/);
  });

  it('ignores a decoration that comes before any node', () => {
    expect(render('mindmap\n::icon(fa fa-book)\n:::big\nroot', options).svg).toContain('>root</text>');
  });

  it('draws icons and applies classes', () => {
    const src = 'mindmap\n  root\n    A\n    ::icon(fa fa-book)\n    :::urgent large\n    B';
    const plain = render(src, options);
    expect(plain.svg).toContain('class="pele-node pele-shape-text urgent large" data-id="A"');
    expect(plain.svg).not.toContain('pele-icon');
    expect(plain.width).toBe(render('mindmap\n  root\n    A\n    B', options).width);
    const drawn = render(src, { ...options, icons: (name) => (name === 'fa fa-book' ? '<path d="M0,0H24"/>' : null) });
    expect(drawn.svg).toContain('<svg class="pele-icon" data-icon="fa fa-book"');
    expect(drawn.svg).toContain('stroke-linejoin="round"><path d="M0,0H24"/></svg>');
    expect(drawn.width).toBeGreaterThan(plain.width);
  });

  it('formats markdown and breaks lines', () => {
    const { svg } = render('mindmap\n  id1["`**Root** with\na second line`"]\n    id2[One<br/>Two]\n    id3[*emphasis*]', options);
    expect(svg).toContain(' font-weight="var(--_w)">Root</tspan><tspan> with</tspan>');
    expect(svg).toContain('a second line');
    expect(svg).toMatch(/>One<\/tspan><tspan[^>]*>Two</);
    expect(svg).toMatch(/<text[^>]* font-style="italic"[^>]*><tspan[^>]*>emphasis</);
  });

  it('wraps long text at maxNodeWidth', () => {
    const body = 'mindmap\n  root[' + 'several words that go on '.repeat(4) + ']';
    const normal = render(body, options);
    const narrow = render('---\nconfig:\n  mindmap:\n    maxNodeWidth: 80\n---\n' + body, options);
    expect(normal.width).toBeLessThan(260);
    expect(narrow.width).toBeLessThan(normal.width);
    expect(narrow.height).toBeGreaterThan(normal.height);
  });

  it('keeps a trailing comment out of a shaped node but not out of a bare one', () => {
    expect(model('mindmap\n  root(Root) %% note\n    a').nodes[0].descr).toBe('Root');
    expect(model('mindmap\n  root %% note\n    a').nodes[0].descr).toBe('root %% note');
  });

  it('draws the front matter title', () => {
    const plain = render('mindmap\n  root\n    A', options);
    const titled = render('---\ntitle: Plans\n---\nmindmap\n  root\n    A', options);
    expect(titled.svg).toContain('class="pele-title" font-weight="var(--_tw)"');
    expect(titled.svg).toContain('>Plans<');
    expect(titled.height).toBeGreaterThan(plain.height);
  });

  it('renders a mindmap with no nodes and one with only a root', () => {
    expect(render('mindmap\n\n', options).svg).toContain('<svg');
    expect(render('mindmap\nroot', options).svg.match(/class="pele-node/g)?.length).toBe(1);
  });

  it('sets the levels apart: a pill for a node that branches, plain text for one that ends a branch', () => {
    const { svg } = render('mindmap\n  root\n    Plan\n      Research\n        Read\n        Ask\n      Build\n    Ship', options);
    const kinds = new Map([...svg.matchAll(/class="pele-node pele-shape-(\w+)[^"]*" data-id="([^"]*)"/g)].map((m) => [m[2], m[1]]));
    expect(kinds.get('Plan')).toBe('branch');
    expect(kinds.get('Research')).toBe('branch');
    for (const leaf of ['Read', 'Ask', 'Build', 'Ship']) expect(kinds.get(leaf), leaf).toBe('text');
    expect(svg).toMatch(/pele-shape-branch" data-id="Plan"[^>]*><rect[^>]* fill="var\(--pele-series-\d,[^"]*\)" fill-opacity="0.22" stroke="var\(--pele-series-\d,[^"]*\)"\/>/);
    expect(svg).toMatch(/pele-shape-text" data-id="Read"[^>]*><text/);
    expect(svg).not.toContain('pele-marker');
    // Nodes on one level start at the same place, whatever their length.
    const box = new Map([...svg.matchAll(/data-id="([^"]*)" transform="translate\((-?[\d.]+),[^)]*\)">(?:<rect x="(-?[\d.]+)")?/g)].map((m) => [m[1], Number(m[2])]));
    const side = Math.sign(box.get('Read')! - box.get('Research')!);
    expect(side).not.toBe(0);
    const widths = new Map([['Read', metricsMeasurer.width('Read', 16, 0)], ['Ask', metricsMeasurer.width('Ask', 16, 0)]]);
    const near = (id: string): number => box.get(id)! - (side * (widths.get(id)! + 12)) / 2;
    expect(near('Read')).toBeCloseTo(near('Ask'), 1);
  });

  it('is deterministic and emits only finite numbers', () => {
    const src = 'mindmap\n  root((mindmap))\n    Origins\n      Long history\n      ::icon(fa fa-book)\n    Research\n      On effectiveness<br/>and features\n    Tools\n      Pen and paper';
    const first = render(src, options).svg;
    expect(render(src, options).svg).toBe(first);
    expect(first).not.toMatch(/NaN|Infinity|undefined/);
  });
});
