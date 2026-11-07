// Bundles the core service into one plain-JS ESM file that Electron runs with
// ELECTRON_RUN_AS_NODE=1. better-sqlite3 stays external: it is a native module
// rebuilt for Electron's ABI and loaded at runtime via require().
import { build } from 'esbuild';
import { readFileSync } from 'node:fs';

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'));

await build({
  entryPoints: ['src/index.ts'],
  outfile: 'dist/core.mjs',
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node22',
  sourcemap: true,
  external: ['better-sqlite3'],
  define: { __CORE_VERSION__: JSON.stringify(pkg.version) },
  logLevel: 'info',
});
