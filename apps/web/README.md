# apps/web — getsyncvault.com

The Syncvault landing page. **Astro** (static output), Tailwind v4 with the shared tokens from
`packages/tokens`, Inter + IBM Plex Mono self-hosted. No analytics, no third-party requests.

```bash
pnpm dev:web          # http://localhost:4321
pnpm build:web        # → apps/web/dist
pnpm --filter @syncvault/web preview
```

## Theme

The website is **dark-only**: `src/styles/global.css` overrides the shared tokens from
`packages/tokens` (page, card, text, border, primary-light/text) for the site only — the desktop app
keeps its own theme. Small blue text uses `primary-bright` (#60A5FA) for AA contrast on black.
Cards and rows with the `.spot` class get the blue pointer spotlight on hover.

## Animation

CSS + SVG only — no animation library.

- `src/scripts/motion.ts` adds `.is-visible` to `[data-reveal]` containers when they scroll into view;
  `.reveal` children animate in (staggered with the `[--i:n]` class).
- Hidden start states only apply under `@media (prefers-reduced-motion: no-preference)` **and**
  `@media (scripting: enabled)`, so with reduced motion or without JS everything is simply visible.
- `ConnectDiagram.astro` — thin 1px SVG curves on a fixed-ratio stage (viewBox 1000×360); cards are
  positioned in %, so lines always meet them. Lines draw in, the lock closes, then grey dots (readable
  files) flow into Syncvault and blue dots (locked data) flow out (SMIL `animateMotion`).
- Signature pieces: `scripts/decrypt.ts` (headlines resolve from ciphertext), `scripts/flow.ts`
  (file chips that scramble as they pass through Syncvault), `scripts/lens.ts` (privacy "key lens",
  card spotlight, app-window tilt)
  and `components/SectionHeader.astro` (mono `01 — Label` headers).
- No inline `style=""` attributes — the CSP has no `'unsafe-inline'`; dynamic values are set through
  CSSOM (`style.setProperty`), which the CSP allows.

## Security headers / CSP

- Astro's `security.csp` emits a `<meta>` CSP with hashes for its own scripts and styles.
- `vercel.json` adds HTTP headers that can't go in a meta tag: `frame-ancestors`, HSTS,
  `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`, and long caching for `/_astro/*`.

## Deploying to Vercel

Create a Vercel project from the repository with:

| Setting                  | Value                                                                       |
| ------------------------ | --------------------------------------------------------------------------- |
| Root Directory           | `apps/web`                                                                  |
| Framework preset         | Astro (read from `vercel.json`)                                             |
| Install / build / output | from `vercel.json` (`pnpm install --frozen-lockfile`, `pnpm build`, `dist`) |
| Node.js version          | 24.x (Astro needs ≥ 22.22)                                                  |
| Environment variable     | `ELECTRON_SKIP_BINARY_DOWNLOAD=1` (skips the ~100 MB Electron download)     |

The root `postinstall` skips the Electron native rebuild automatically when `VERCEL` is set
(`scripts/postinstall.mjs`). pnpm is picked up from the root `packageManager` field.

## TODO

- Real download / GitHub / sponsor links in `src/site.ts` once the repo and first release are public.
- Sinhala and Tamil versions of the page.
