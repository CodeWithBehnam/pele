import { describe, expect, it } from 'vitest';
import { PeleError, parse, render, supports } from '../../src/index.js';
import { metricsMeasurer } from '../../src/text/measurer.js';
import { loadCorpus, mutator, random } from '../support/corpus.js';
import { PAYLOADS, assertInert } from '../support/inert.js';

const options = { measurer: metricsMeasurer };

function tryRender(src: string): string | undefined {
  try {
    return render(src, options).svg;
  } catch (error) {
    if (error instanceof PeleError) return undefined;
    throw error;
  }
}

describe('pie rendering', () => {
  it('draws a slice, a percentage, and a legend entry per section', () => {
    const { svg, type } = render('pie title Pets\n "Dogs" : 386\n "Cats" : 85\n "Rats" : 15', options);
    expect(type).toBe('pie');
    expect(supports('pie\n "a": 1')).toBe(true);
    expect(svg.match(/class="pele-slice"/g)?.length).toBe(3);
    expect(svg.match(/class="pele-legend-item"/g)?.length).toBe(3);
    expect(svg).toContain('>79%<');
    expect(svg).toContain('>Pets<');
    expect(svg).toContain('var(--pele-series-1,');
  });

  it('shows values in the legend with showData', () => {
    expect(render('pie showData\n "A" : 42.96\n "B" : 50', options).svg).toContain('A [42.96]');
  });

  it('leaves out slices under one percent but keeps them in the legend', () => {
    const { svg } = render('pie\n "Big" : 1000\n "Tiny" : 1', options);
    expect(svg.match(/class="pele-slice"/g)?.length).toBe(1);
    expect(svg.match(/class="pele-legend-item"/g)?.length).toBe(2);
  });

  it('draws a single full slice and an empty chart', () => {
    expect(render('pie\n "Only" : 5', options).svg).toContain('>100%<');
    expect(render('pie\n "Zero" : 0', options).svg).not.toContain('NaN');
    expect(render('pie', options).svg).toContain('<svg');
  });

  it('honours donutHole, textPosition and legendPosition', () => {
    const plain = render('pie\n "A" : 1\n "B" : 1', options);
    const donut = render('---\nconfig:\n  pie:\n    donutHole: 0.5\n---\npie\n "A" : 1\n "B" : 1', options);
    const below = render('---\nconfig:\n  pie:\n    legendPosition: bottom\n---\npie\n "A" : 1\n "B" : 1', options);
    expect(donut.svg).not.toBe(plain.svg);
    expect(below.height).toBeGreaterThan(plain.height);
    expect(below.width).toBeLessThan(plain.width);
  });

  it('moves the labels of thin slices outside the rim apart', () => {
    const { svg } = render('pie\n "Calcium" : 2\n "Potassium" : 2.4\n "Magnesium" : 46\n "Test" : 50', options);
    const outside = [...svg.matchAll(/<g class="pele-slice-labels"[^>]*font-size="(\d+)" text-anchor="middle">(.*?)<\/g>/g)].find((m) => !m[0].includes('fill='));
    expect(outside).toBeDefined();
    const size = Number(outside![1]);
    const boxes = [...outside![2].matchAll(/<text x="([-\d.]+)" y="([-\d.]+)">([^<]*)<\/text>/g)].map(([, x, y, text]) => ({
      x: Number(x),
      y: Number(y),
      w: metricsMeasurer.width(text, size, 0),
    }));
    expect(boxes.length).toBe(2);
    const [a, b] = boxes;
    const apart = Math.abs(a.x - b.x) >= (a.w + b.w) / 2 || Math.abs(a.y - b.y) >= size;
    expect(apart).toBe(true);
  });

  it('takes the title from front matter unless the chart sets one', () => {
    expect(render('---\ntitle: From front matter\n---\npie\n "A" : 1', options).svg).toContain('From front matter');
    expect(render('---\ntitle: From front matter\n---\npie title Own\n "A" : 1', options).svg).toContain('>Own<');
  });

  it('rejects negative values with Mermaid\'s message', () => {
    expect(() => render('pie\n "dogs" : -60.67', options)).toThrow(
      '"dogs" has invalid value: -60.67. Negative values are not allowed in pie charts. All slice values must be >= 0.'
    );
  });

  it('exposes the model', () => {
    const model = parse('pie showData\n "A" : 1\n "A" : 2\n "B" : 3');
    expect(model.type).toBe('pie');
    if (model.type === 'pie') {
      expect([...model.sections]).toEqual([['A', 1], ['B', 3]]);
      expect(model.showData).toBe(true);
    }
  });

  it('is inert for corpus, hostile, and mutated inputs', () => {
    const corpus = loadCorpus('pie', /pie/);
    for (const src of corpus) {
      const svg = tryRender(src);
      if (svg !== undefined) assertInert(svg, src);
    }
    let rendered = 0;
    for (const payload of PAYLOADS) {
      for (const src of [
        `pie title ${payload}\n "a" : 1`,
        `pie\n "${payload}" : 1\n "b" : 2`,
        `pie\n accTitle: ${payload}\n accDescr: ${payload}\n "a" : 1`,
        `pie\n accDescr {\n ${payload}\n }\n "a" : 1`,
        `---\ntitle: "${payload}"\nconfig:\n  pie:\n    legendPosition: "${payload}"\n    textPosition: "${payload}"\n---\npie\n "a" : 1`,
      ]) {
        const svg = tryRender(src);
        if (svg === undefined) continue;
        assertInert(svg, src);
        rendered++;
      }
    }
    expect(rendered).toBeGreaterThan(60);
    const next = mutator(corpus, [...PAYLOADS, '"', ':', '\n', 'title ', 'showData'], random(5));
    for (let i = 0; i < 2000; i++) {
      const src = next();
      const svg = tryRender(src);
      if (svg !== undefined) assertInert(svg, src);
    }
  });

  it('stays fast on oversized input', () => {
    const big = { ...options, limit: Infinity };
    const cases = [
      'pie\n' + Array.from({ length: 5000 }, (_, i) => `"s${i}" : ${i}\n`).join(''),
      'pie title ' + 'x'.repeat(50000),
      'pie\n"' + 'a'.repeat(50000),
      'pie\n' + '%%{\n'.repeat(12000),
      'pie\n' + 'x ---\n'.repeat(8000),
      'pie\naccDescr {' + ' a\n'.repeat(15000),
      'pie\n' + ' '.repeat(50000) + '"a":1',
    ];
    for (const src of cases) {
      const started = performance.now();
      try {
        render(src, big);
      } catch (error) {
        expect(error).toBeInstanceOf(PeleError);
      }
      expect(performance.now() - started, src.slice(0, 30)).toBeLessThan(2000);
    }
  });
  it('reads a long run of digits in linear time', () => {
    for (const tail of ['0'.repeat(49000), '0'.repeat(49000) + '.', '9'.repeat(49000) + '..', '-' + '1.'.repeat(24000)]) {
      const started = performance.now();
      expect(() => render('pie\n"a": ' + tail, options)).toThrow(PeleError);
      expect(performance.now() - started).toBeLessThan(500);
    }
  });
});
