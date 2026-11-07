#!/usr/bin/env node
// Root postinstall: rebuild native modules (better-sqlite3) for Electron's ABI.
// Skipped on Vercel (website builds don't need Electron) or when explicitly disabled.
import { spawnSync } from 'node:child_process';

if (process.env.VERCEL || process.env.SYNCVAULT_SKIP_NATIVE_REBUILD) {
  console.log('postinstall: skipping native rebuild (VERCEL / SYNCVAULT_SKIP_NATIVE_REBUILD set)');
  process.exit(0);
}

const result = spawnSync('pnpm', ['run', 'rebuild:native'], {
  stdio: 'inherit',
  shell: process.platform === 'win32',
});
process.exit(result.status ?? 1);
