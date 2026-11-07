# CLAUDE.md — Syncvault

Guidance for AI assistants and human contributors. **Read this file and `docs/` before changing anything.**

## Project summary

Syncvault is a free, open-source (GPL-3.0) desktop app that encrypts files on the user's computer
(zero-knowledge) and keeps them in sync with Google Drive, OneDrive, Dropbox and 40+ other services,
across many accounts. Tagline: _"All your clouds, in sync. Only you hold the key."_
Website: https://getsyncvault.com

- First release: **Linux** (Ubuntu, Fedora). Windows and macOS later — **all code must be cross-platform now.**
- Stack (decided, do not change): pnpm workspaces monorepo, TypeScript strict everywhere;
  Electron + React + Tailwind (electron-vite) UI; Node core service running on Electron's own Node
  (`ELECTRON_RUN_AS_NODE=1`); rclone (`rclone rcd` + rclone crypt) as sync/encryption engine;
  Rust napi-rs crate for key handling (not wired in yet); Vitest; ESLint + Prettier; electron-builder.

## Commands

| Task                   | Command                                                                                   |
| ---------------------- | ----------------------------------------------------------------------------------------- |
| Install                | `pnpm install` (runs `rebuild:native` for Electron's ABI)                                 |
| Download rclone        | `pnpm fetch:rclone` (current platform; `--all` for every one)                             |
| Dev (window + core)    | `pnpm dev`                                                                                |
| Dev without OS sandbox | `pnpm dev:no-sandbox` — dev-only last resort for Ubuntu AppArmor issue (see CONTRIBUTING) |
| Build                  | `pnpm build`                                                                              |
| Package (Linux)        | `pnpm dist:linux` (AppImage + .deb)                                                       |
| Test                   | `pnpm test`                                                                               |
| Lint / format          | `pnpm lint`, `pnpm format`, `pnpm format:check`                                           |
| Typecheck              | `pnpm typecheck`                                                                          |
| Rebuild native modules | `pnpm rebuild:native` (after changing Electron or better-sqlite3)                         |
| Rust crate (optional)  | `cargo check --manifest-path crates/vault/Cargo.toml`                                     |

Requirements: Node (see `.nvmrc`), pnpm via Corepack (`corepack enable`), a C/C++ toolchain for
better-sqlite3. Rust is **not** required for `pnpm dev`.

## Architecture map

```
Renderer (React, sandboxed)
  └─ window.syncvault (preload, contextBridge)   apps/desktop/src/preload
       └─ ipcRenderer.invoke ──► Electron main   apps/desktop/src/main
                                  │  zod-validates every request, allow-list of methods
                                  └─ JSON-RPC 2.0 over Unix socket / Windows named pipe
                                       └─► Core service (packages/core, ELECTRON_RUN_AS_NODE=1)
                                             ├─ rpc/     JSON-RPC server, token auth
                                             ├─ rclone/  spawns `rclone rcd`, typed HTTP client
                                             ├─ db/      SQLite (better-sqlite3) + migrations
                                             ├─ sync/    job queue, locks, debounce (TODO)
                                             └─ watch/   chokidar watchers (TODO)
                                                  └─► rclone rcd on 127.0.0.1 ──► cloud providers
```

- `packages/shared`: types, zod schemas, RPC method names (`rpcMethods`), IPC channel names. Source-consumed (no build step).
- `packages/core`: bundled with esbuild to `packages/core/dist/core.mjs`; spawned by main with
  `process.execPath` + `ELECTRON_RUN_AS_NODE=1`.
- `apps/desktop/src/main/paths.ts` is the **only** place that resolves resource paths (dev → repo paths,
  packaged → `process.resourcesPath`).
- `crates/vault`: Rust (napi-rs) — Argon2id, in-memory keys, OS keychain. **The app must not depend on it yet.**
- Single instance (`app.requestSingleInstanceLock()`); main restarts a crashed core with backoff;
  quitting stops core, core stops rclone. Core exits if main disappears (stdin EOF).
- RPC auth: main generates a random token per start, passes it in env; the first message on each
  connection must be `auth.hello` with that token.

## Security rules (non-negotiable)

- **Electron**: `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`, `webSecurity` on;
  strict CSP in production (relaxed only in dev for Vite HMR — see `apps/desktop/electron.vite.config.ts`);
  never load remote URLs in app windows; block `will-navigate` and new windows
  (`setWindowOpenHandler` → deny); external links open in the system browser only after allow-list validation;
  preload exposes only small, typed functions (`SyncvaultBridge` in `packages/shared/src/bridge.ts`).
- Never log secrets, tokens, passwords, keys, or full paths of user content at info level.
- Encryption keys and the master password live **only in memory**. Never write them to disk.
- rclone.conf holds cloud OAuth tokens and crypt settings → it must **always** be encrypted with rclone's
  config encryption. The config password is supplied at runtime (`--password-command` or
  `RCLONE_CONFIG_PASS` in the child env), never written to disk in plain text. The config password itself is
  protected by the vault (derived from the master password and/or stored in the OS keychain).
  _Scaffold status: TODO — rclone currently starts with an empty, Syncvault-only config and no remotes._
- Other secrets (e.g. the vault's wrapped key) are stored in the OS keychain only.
- rclone is always started with Syncvault's own config (`--config <appData>/rclone/rclone.conf`).
  Never read or modify the user's `~/.config/rclone/rclone.conf`.
- rclone rc: `127.0.0.1` only, random port + random user/password every start, passed via
  `RCLONE_RC_USER` / `RCLONE_RC_PASS` env vars (never argv — visible in `ps`). Never `--rc-no-auth`, no web GUI.
- No telemetry, no analytics, no network calls except the user's chosen cloud providers and the update server.
- Proven crypto only (rclone crypt, Argon2id). Never invent crypto.

## Data safety rules (non-negotiable)

Details in `docs/DATA-SAFETY.md`; defaults live in `DATA_SAFETY_DEFAULTS` (`packages/shared/src/constants.ts`).

- Never delete or overwrite user files without a backup. bisync: `--backup-dir1` (local side) and
  `--backup-dir2` (cloud side, same remote as path2). One-way sync/copy: `--backup-dir` on the destination remote.
- Two delete checks: (a) Syncvault's own — if a run would delete more than N files (default 50), pause and ask
  (count first with `--dry-run`); (b) keep bisync's `--max-delete` — a **percentage** (default 50%), not a count.
- One lock per sync folder: never run two jobs on the same folder concurrently.
- Debounce file events (default 3 s) before syncing.
- First bisync requires `--resync`; handle it explicitly, never silently.
- Respect rclone's lock/listing files; never delete them manually.
- Job queue persisted in SQLite and safe to retry (idempotent).
- Tests are required for any code that deletes, moves, or overwrites files.

## Cross-platform rules

- Never hard-code paths: use `path`, `os.homedir()`, `os.tmpdir()`, Electron `app.getPath()`.
- IPC: Unix domain socket on Linux/macOS (`$XDG_RUNTIME_DIR` on Linux, fallback app data dir; dir `0700`,
  socket `0600`); named pipe with random name on Windows.
- Be CRLF-safe when parsing text (split on `/\r?\n/`). Repo files use LF (`.gitattributes`).
- Binaries: `rclone` vs `rclone.exe` — use `rcloneExecutableName()`.
- Linux inotify watch limit (`fs.inotify.max_user_watches`): TODO — detect `ENOSPC` from watchers and tell the user.

## Code style

- TypeScript strict, **no `any`** (lint error). Prefer `unknown` + zod.
- zod-validate every RPC input (both in main and in core) and every external response (rclone, env).
- Small modules, **named exports** only, async/await.
- Errors as typed results at boundaries (`Result<T, E>` from `@syncvault/shared`); throw only inside a module.
- UI text only through `locales/*.json` (`t('key')`) — no hard-coded strings in components.

## UI / design system

Tailwind v4 tokens are defined in `apps/desktop/src/renderer/styles.css` (`@theme`).

- Primary blue `#2563EB` (hover `#1D4ED8`, text-on-light `#1E40AF`, light `#EFF4FF`, bright-on-black `#60A5FA`).
- Black `#0A0A0B` (raised `#1F1F23`) for sidebar and dark panels. Text `#111827`, gray text `#4B5563`,
  border `#E3E6EB`, page background `#F6F7F9`, white cards.
- Warning bg `#FEF3E2` / text `#92400E`. Error bg `#FEE2E2` / text `#B91C1C`.
- Blue is the **only** action colour. Orange only for warnings like "Not encrypted" — **never red** for "not encrypted".
- Fonts: IBM Plex Sans (UI), IBM Plex Mono (paths), bundled via `@fontsource` (no Google Fonts at runtime; OFL in
  `apps/desktop/src/renderer/assets/fonts/OFL.txt`).
- Touch targets ≥ 44 px, WCAG AA contrast, real `<button>`/`<label>`, fully keyboard accessible.
- Theme: System / Light / Dark (light is the default look).

## MVP scope

In: Linux; Google Drive + OneDrive; master password + recovery key; multiple accounts; encrypted sync folders
(encryption on by default); automatic two-way sync; tray; screens: Welcome, Dashboard, Sync folders,
Add account, New sync folder, Activity, Settings.
Out: mobile, sharing, Teams, mount mode, Windows/macOS installers.

## Workflow for AI assistants

1. Read this file and `docs/` first.
2. Keep changes small and focused.
3. Run `pnpm typecheck && pnpm lint && pnpm test` before finishing.
4. Never weaken a security or data-safety rule. If a task seems to require it, stop and ask.
5. Ask before adding dependencies.
6. Update `docs/` (especially `ARCHITECTURE.md`) when architecture changes.
7. Never commit secrets, rclone binaries, databases, or user data.
