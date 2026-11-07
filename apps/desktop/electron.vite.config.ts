import { resolve } from 'node:path';
import { defineConfig } from 'electron-vite';
import type { Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

/**
 * Content-Security-Policy injected into index.html.
 * Production: strict. Development: relaxed ONLY for Vite HMR (inline React refresh preamble,
 * websocket to the dev server). Never ship the dev policy.
 */
const PROD_CSP = [
  "default-src 'none'",
  "script-src 'self'",
  "style-src 'self'",
  "img-src 'self' data:",
  "font-src 'self' data:",
  "connect-src 'self'",
  "base-uri 'none'",
  "form-action 'none'",
  "frame-ancestors 'none'",
  "object-src 'none'",
].join('; ');

const DEV_CSP = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data:",
  "font-src 'self' data:",
  "connect-src 'self' ws://localhost:* http://localhost:*",
  "object-src 'none'",
].join('; ');

const cspPlugin = (): Plugin => ({
  name: 'syncvault-csp',
  transformIndexHtml: {
    order: 'pre',
    handler: (html, ctx) => html.replace('%SYNCVAULT_CSP%', ctx.server ? DEV_CSP : PROD_CSP),
  },
});

// @syncvault/shared is consumed as TypeScript source, so it must be bundled, not externalized.
const bundleShared = { externalizeDeps: { exclude: ['@syncvault/shared'] } };

export default defineConfig({
  main: {
    build: { ...bundleShared },
  },
  preload: {
    // Sandboxed preloads can only require 'electron' — bundle everything else.
    build: { externalizeDeps: false },
  },
  renderer: {
    root: resolve(__dirname, 'src/renderer'),
    plugins: [cspPlugin(), react(), tailwindcss()],
    build: {
      rollupOptions: { input: resolve(__dirname, 'src/renderer/index.html') },
    },
  },
});
