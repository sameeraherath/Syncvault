// @ts-check
import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  site: 'https://getsyncvault.com',
  output: 'static',
  trailingSlash: 'ignore',
  build: { inlineStylesheets: 'never' },
  // No markdown code blocks on this site; Shiki's inline styles would also conflict with CSP.
  markdown: { syntaxHighlight: false },
  // Strict CSP as a <meta> tag with hashes for Astro's own scripts/styles.
  // frame-ancestors / HSTS etc. are set as HTTP headers in vercel.json.
  security: {
    csp: {
      directives: [
        "default-src 'self'",
        "img-src 'self' data:",
        "font-src 'self'",
        "connect-src 'self'",
        "object-src 'none'",
        "base-uri 'none'",
        "form-action 'none'",
      ],
    },
  },
  vite: { plugins: [tailwindcss()] },
});
