import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parse, render } from '../../src/index.js';
import { metricsMeasurer } from '../../src/text/measurer.js';
import { literalLabel, breakLabel } from '../../src/diagrams/common/literal-label.js';
import { layoutLabel } from '../../src/text/label.js';
import { assertInert } from '../support/inert.js';
import { elements } from '../support/xml.js';

const options = { measurer: metricsMeasurer, now: 0 };
const phone = { ...options, maxWidth: 320 };
const sources = (name: string): string[] => JSON.parse(readFileSync(`tests/corpus/${name}-docs.json`, 'utf8'));
const texts = (svg: string): string[] => [...svg.matchAll(/<text\b[^>]*>([\s\S]*?)<\/text>/g)].map(match => match[1].replace(/<[^>]+>/g, '').replace(/\s/g, ''));

const TREE = 'treeView-beta\n  project/\n    very_long_filename_that_must_wrap_without_losing_any_characters.ts :::highlight ## A description that should move below its filename on a phone\n    source/\n      app.ts\n';

describe('mobile diagram layouts', () => {
  it('compacts every newly supported type while retaining its model and desktop drawing', () => {
    for (const name of ['sequence', 'railroad', 'journey', 'packet', 'c4', 'architecture', 'eventmodeling', 'swimlane', 'block', 'ishikawa']) {
      const source = sources(name).sort((a, b) => render(b, options).width - render(a, options).width)[0];
      const model = parse(source), before = JSON.stringify(model);
      const wide = render(model, options);
      const narrow = render(model, phone);
      expect(narrow.width, name).toBeLessThan(wide.width);
      expect(JSON.stringify(model), name).toBe(before);
      expect(render(model, { ...options, maxWidth: wide.width }).svg, name).toBe(wide.svg);
      expect(render(model, options).svg, name).toBe(wide.svg);
      expect(narrow.svg.match(/font:(\d+)px/)?.[1], name).toBe(wide.svg.match(/font:(\d+)px/)?.[1]);
      assertInert(narrow.svg, name);
    }
  });

  it('keeps participants, messages, notes and numbering readable in a four-party sequence', () => {
    const source = sources('sequence')[1];
    const wide = render(source, options), narrow = render(source, phone);
    expect(narrow.width).toBeLessThanOrEqual(320);
    expect(narrow.height).toBeGreaterThan(wide.height);
    const labels = texts(narrow.svg);
    for (const label of texts(wide.svg)) expect(labels).toContain(label);
    expect(narrow.svg.match(/class="pele-activation"/g)?.length).toBe(wide.svg.match(/class="pele-activation"/g)?.length);
  });

  it('wraps nested railroad sequences without losing grammar elements or overlapping boxes', () => {
    const source = sources('railroad')[8];
    const wide = render(source, options), narrow = render(source, phone);
    expect(narrow.width).toBeLessThanOrEqual(320);
    expect(narrow.height).toBeGreaterThan(wide.height);
    expect(texts(narrow.svg)).toEqual(texts(wide.svg));
    const boxes = elements(narrow.svg).filter(el => el.name === 'rect').map(el => ({ x: Number(el.attrs.get('x')), y: Number(el.attrs.get('y')), w: Number(el.attrs.get('width')), h: Number(el.attrs.get('height')) }));
    for (let i = 0; i < boxes.length; i++) {
      const a = boxes[i];
      expect(a.x >= 0 && a.y >= 0 && a.x + a.w <= narrow.width && a.y + a.h <= narrow.height).toBe(true);
      for (const b of boxes.slice(i + 1)) expect(a.x + a.w <= b.x || b.x + b.w <= a.x || a.y + a.h <= b.y || b.y + b.h <= a.y).toBe(true);
    }
    expect(narrow.svg.match(/pele-start/g)?.length).toBe(wide.svg.match(/pele-start/g)?.length);
    expect(narrow.svg.match(/pele-end/g)?.length).toBe(wide.svg.match(/pele-end/g)?.length);
  });

  it('preserves every bit and field when packet rows split, including descending numbering', () => {
    for (const bitOrder of ['ascending', 'descending']) {
      const source = `---\nconfig:\n  packet:\n    bitOrder: ${bitOrder}\n---\npacket\n0-31: "Header"\n32-39: "Flags"\n40-127: "Payload"`;
      const narrow = render(source, phone);
      const ranges = [...narrow.svg.matchAll(/class="pele-node" data-id="(\d+)-(\d+)"/g)].map(match => [Number(match[1]), Number(match[2])]);
      let next = 0;
      for (const [from, to] of ranges) { expect(from).toBe(next); next = to + 1; }
      expect(next).toBe(128);
      expect(narrow.width).toBeLessThanOrEqual(320);
      for (const name of ['Header', 'Flags', 'Payload']) expect(texts(narrow.svg)).toContain(name);
      expect(narrow.svg).not.toContain('…');
      expect(render(source, { ...phone, autoDirection: false }).svg).toBe(render(source, options).svg);
    }
  });

  it('uses taller rows only where packet labels need them', () => {
    const narrow = render(sources('packet')[0], phone);
    const heights = elements(narrow.svg).filter(el => el.name === 'rect').map(el => Number(el.attrs.get('height')));
    expect(new Set(heights).size).toBeGreaterThan(1);
    for (const label of ['URG', 'ACK', 'PSH', 'RST', 'SYN', 'FIN']) expect(texts(narrow.svg)).toContain(label);
    expect(narrow.height).toBeLessThan(1200);
  });

  it('keeps journey order, section headings, scores and actors in the vertical drawing', () => {
    const source = 'journey\n  title Delivery\n  section Prepare\n    Read requirements: 3: Alice, Bob\n    Make a plan: 4: Alice\n  section Finish\n    Review the result: 5: Bob';
    const narrow = render(source, phone);
    expect(narrow.width).toBeLessThanOrEqual(320);
    const labels = texts(narrow.svg);
    for (const value of ['Delivery', 'Prepare', 'Finish', 'Readrequirements', 'Makeaplan', 'Reviewtheresult', 'Alice', 'Bob', '3', '4', '5']) expect(labels).toContain(value);
    const steps = [...narrow.svg.matchAll(/class="pele-node pele-journey-step" data-id="(\d+)"/g)].map(match => Number(match[1]));
    expect(steps).toEqual([0, 1, 2]);
  });

  it('keeps event frames, lanes, data, reset markers, explicit relations and specifications', () => {
    for (const source of sources('eventmodeling')) {
      const model = parse(source);
      if (model.type !== 'eventmodeling') throw new Error('fixture type');
      const narrow = render(model, phone);
      expect(narrow.width).toBeLessThanOrEqual(320);
      const labels = texts(narrow.svg);
      for (const box of model.boxes) {
        expect(narrow.svg).toContain(`data-id="${box.id}"`);
        expect(labels).toContain(box.lane.label.replace(/\s/g, ''));
      }
      const wide = render(model, options);
      expect(narrow.svg.match(/class="pele-edge"/g)?.length ?? 0).toBe(wide.svg.match(/class="pele-edge"/g)?.length ?? 0);
      expect(narrow.svg.match(/pele-em-reset/g)?.length ?? 0).toBe(wide.svg.match(/pele-em-reset/g)?.length ?? 0);
      expect(narrow.svg.match(/class="pele-em-specification"/g)?.length ?? 0).toBe(model.specifications.length);
      expect(narrow.svg.match(/class="pele-em-note"/g)?.length ?? 0).toBe(model.notes.length);
    }
  });

  it('wraps filenames and moves descriptions underneath without changing the hierarchy', () => {
    const wide = render(TREE, options), narrow = render(TREE, phone);
    expect(narrow.width).toBeLessThanOrEqual(320);
    expect(narrow.height).toBeGreaterThan(wide.height);
    expect(texts(narrow.svg).join('')).toBe(texts(wide.svg).join(''));
    expect(narrow.svg.match(/class="pele-node/g)?.length).toBe(wide.svg.match(/class="pele-node/g)?.length);
    expect(narrow.svg.match(/<path/g)?.length).toBe(wide.svg.match(/<path/g)?.length);
    const file = narrow.svg.slice(narrow.svg.indexOf('data-id="very_long_filename_that_must_wrap_without_losing_any_characters.ts"'));
    const filenameY = Number(file.match(/<text class="pele-label"[\s\S]*?y="([\d.]+)"/)![1]);
    const descriptionY = Number(file.match(/<text class="pele-tree-description"[\s\S]*?y="([\d.]+)"/)![1]);
    expect(descriptionY).toBeGreaterThan(filenameY);
    assertInert(narrow.svg);
  });

  it('retains every category and nested cause in the narrow Ishikawa tree', () => {
    const source = sources('ishikawa')[0];
    const model = parse(source);
    if (model.type !== 'ishikawa') throw new Error('fixture type');
    const narrow = render(model, phone);
    expect(narrow.width).toBeLessThanOrEqual(320);
    const labels = texts(narrow.svg);
    const pending = model.root ? [model.root] : [];
    let count = 0;
    for (let i = 0; i < pending.length; i++) { count++; expect(labels).toContain(pending[i].text.replace(/\s/g, '')); pending.push(...pending[i].children); }
    expect(narrow.svg.match(/class="pele-edge"/g)?.length).toBe(count - 1);
    expect(render(source, { ...phone, autoDirection: false }).svg).toBe(render(source, options).svg);
  });

  it('fits quadrant and Wardley examples to phone widths without shrinking the root font', () => {
    for (const name of ['quadrant', 'wardley']) {
      for (const source of sources(name)) {
        const narrow = render(source, phone);
        expect(narrow.width, name).toBeLessThanOrEqual(322);
        expect(narrow.svg).toContain('font:16px');
      }
    }
  });

  it('preserves literal text, Unicode and styled spans through long-word wrapping', () => {
    const raw = '<literal>& emoji 🐈 中文 ' + 'filename_'.repeat(40);
    const label = literalLabel(raw, metricsMeasurer, 16, 100);
    expect(label.lines.flat().map(span => span.text).join('')).toBe(raw);
    expect(label.width).toBeLessThanOrEqual(100);
    const styled = layoutLabel('<b>Supercalifragilisticexpialidocious</b>', false, metricsMeasurer, 16, 400);
    const wrapped = breakLabel(styled, metricsMeasurer, 80);
    expect(wrapped.lines.flat().map(span => span.text).join('')).toBe('Supercalifragilisticexpialidocious');
    expect(wrapped.lines.flat().every(span => span.style === 1)).toBe(true);
    expect(wrapped.width).toBeLessThanOrEqual(80);
  });
});
