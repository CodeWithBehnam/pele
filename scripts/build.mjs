import { build } from 'esbuild';
import { execFileSync } from 'node:child_process';
import { readFileSync, readdirSync, rmSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { browserBuild } from './browser-build.mjs';

rmSync('dist', { recursive: true, force: true });

const shared = {
  bundle: true,
  format: 'esm',
  target: 'es2022',
  minify: true,
  charset: 'utf8',
  legalComments: 'none',
  logLevel: 'warning',
};

// One file with every diagram type.
await build({ ...shared, entryPoints: ['src/index.ts'], outfile: 'dist/pele.js' });

await build({ ...browserBuild, outfile: 'dist/pele.global.js' });

// The same code in pieces: a core, one entry per diagram type, and a loader that fetches a type
// when it is first needed. Code that several of them use goes into shared chunks.
const types = readdirSync('src/entries').map((file) => file.replace(/\.ts$/, ''));
const result = await build({
  ...shared,
  entryPoints: {
    core: 'src/core.ts',
    lazy: 'src/lazy.ts',
    ...Object.fromEntries(types.map((type) => [`diagrams/${type}`, `src/entries/${type}.ts`])),
  },
  outdir: 'dist/esm',
  splitting: true,
  chunkNames: 'chunks/[hash]',
  metafile: true,
});

execFileSync('npx', ['tsc', '-p', 'tsconfig.json'], { stdio: 'inherit' });

const kb = (bytes) => (bytes / 1024).toFixed(1) + ' kB';
const measure = (files) => {
  let raw = 0;
  let gz = 0;
  for (const file of files) {
    const code = readFileSync(file);
    raw += code.length;
    gz += gzipSync(code).length;
  }
  return [raw, gz];
};
const sizes = (files) => {
  const [raw, gz] = measure(files);
  return `${kb(raw)} minified, ${kb(gz)} gzipped`;
};

// Everything an entry needs before it can run: itself and the chunks it imports statically.
const outputs = result.metafile.outputs;
function closure(entry) {
  const seen = new Set();
  const visit = (file) => {
    if (seen.has(file)) return;
    seen.add(file);
    for (const dep of outputs[file].imports) if (dep.kind === 'import-statement') visit(dep.path);
  };
  visit(entry);
  return [...seen];
}

console.log(`dist/pele.js  ${sizes(['dist/pele.js'])}`);
console.log(`dist/pele.global.js  ${sizes(['dist/pele.global.js'])}`);
console.log(`dist/esm/core.js with its chunks  ${sizes(closure('dist/esm/core.js'))}`);
console.log(`dist/esm/lazy.js with its chunks  ${sizes(closure('dist/esm/lazy.js'))}`);
if (process.argv.includes('--sizes')) {
  const core = new Set(closure('dist/esm/core.js'));
  const rows = types.map((type) => [type, ...measure(closure(`dist/esm/diagrams/${type}.js`).filter((file) => !core.has(file)))]);
  rows.sort((a, b) => b[1] - a[1]);
  console.log('\nAdded to the core by each type, loaded alone:');
  for (const [type, raw, gz] of rows) console.log(`  ${type.padEnd(16)} ${kb(raw).padStart(9)} minified, ${kb(gz).padStart(8)} gzipped`);
}
