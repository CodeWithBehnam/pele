import { build } from 'esbuild';
import { readdirSync, readFileSync } from 'node:fs';
import { createContext, runInContext } from 'node:vm';
import { describe, expect, it } from 'vitest';
import { browserBuild } from '../scripts/browser-build.mjs';
import { render } from '../src/index.js';

// Built-ins that are newer than Safari 15.0, the system WebKit of macOS 12. esbuild does not
// lower them, so the browser script must not need them.
const NEWER = [
  ['Array.prototype', ['at', 'findLast', 'findLastIndex', 'toSorted', 'toReversed', 'toSpliced', 'with']],
  ['String.prototype', ['at']],
  ['Object', ['hasOwn', 'groupBy']],
  ['globalThis', ['structuredClone']],
] as const;

const corpus = readdirSync('tests/corpus')
  .filter((file) => file.endsWith('-docs.json'))
  .flatMap((file) => (JSON.parse(readFileSync(`tests/corpus/${file}`, 'utf8')) as string[]).map((source, i) => ({ name: `${file}#${i}`, source })));

describe('the browser script', () => {
  it('draws every documented diagram without built-ins newer than Safari 15.0', async () => {
    const bundle = await build({ ...browserBuild, write: false, minify: false });
    // URL is the page's, not the language's, so the context is given the one Node has.
    const context = createContext({ URL });
    runInContext(`for (const [owner, names] of ${JSON.stringify(NEWER)}) { const target = eval(owner); for (const name of names) delete target[name]; }`, context);
    runInContext(bundle.outputFiles[0].text, context);
    const draw = runInContext('(source) => { try { return pele.render(source).svg; } catch (error) { return "error: " + error.message; } }', context) as (source: string) => string;
    let drawn = 0;
    for (const { name, source } of corpus) {
      let expected: string;
      try {
        expected = render(source).svg;
      } catch (error) {
        expected = `error: ${(error as Error).message}`;
      }
      expect(draw(source), name).toBe(expected);
      if (!expected.startsWith('error')) drawn++;
    }
    expect(drawn).toBeGreaterThan(400);
  });
});
