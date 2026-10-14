import { readFileSync } from 'node:fs';

const { version } = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));

// One script that defines the global `pele`, for a page that loads it with a <script> tag.
// es2021 matches the oldest browsers a host supports: Safari 15 is the system WebKit of macOS 12,
// where Obsidian's Quick Look runs. esbuild lowers syntax to the target but not built-ins, such
// as Object.hasOwn and Array.prototype.at, which tests/browsers.test.ts keeps out.
export const browserBuild = {
  entryPoints: ['src/index.ts'],
  bundle: true,
  format: 'iife',
  globalName: 'pele',
  target: 'es2021',
  minify: true,
  charset: 'utf8',
  legalComments: 'none',
  logLevel: 'warning',
  banner: { js: `/*! Pele ${version} | MIT License | https://github.com/obsidianmd/pele */` },
};
