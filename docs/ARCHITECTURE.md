# Architecture

## Components

| Component     | Location                              | Runs as                                                      | Owns                                                                      |
| ------------- | ------------------------------------- | ------------------------------------------------------------ | ------------------------------------------------------------------------- |
| Renderer      | `apps/desktop/src/renderer`           | Chromium renderer (sandboxed, no Node)                       | React UI, i18n strings, theme                                             |
| Preload       | `apps/desktop/src/preload`            | Sandboxed preload                                            | `window.syncvault` — a tiny typed bridge                                  |
| Electron main | `apps/desktop/src/main`               | Electron main process                                        | Windows, tray, single-instance lock, core supervision, request validation |
| Core service  | `packages/core`                       | Child process: Electron binary with `ELECTRON_RUN_AS_NODE=1` | JSON-RPC server, rclone lifecycle, SQLite, job queue, watchers            |
| Shared        | `packages/shared`                     | Library                                                      | Types, zod schemas, RPC method table                                      |
| rclone        | `resources/rclone/<platform>-<arch>/` | Child process of core (`rclone rcd`)                         | Cloud APIs, crypt encryption, bisync                                      |
| Vault         | `packages/core/src/vault`             | Inside the core service                                      | Master password, recovery key, vault key in memory, `vault.json`          |
| Vault (Rust)  | `crates/vault`                        | Native addon (future)                                        | Hardened replacement: zeroized memory, OS keychain                        |

## Processes

```mermaid
flowchart LR
  R[Renderer<br/>React, sandboxed] -- "contextBridge<br/>ipcRenderer.invoke" --> M[Electron main]
  M -- "spawn: process.execPath<br/>ELECTRON_RUN_AS_NODE=1<br/>env: socket path, token" --> C[Core service]
  M -- "JSON-RPC 2.0 (NDJSON)<br/>Unix socket / named pipe" --> C
  C -- "spawn: rclone rcd<br/>env: RCLONE_RC_USER/PASS" --> RC[rclone rcd<br/>127.0.0.1:random]
  C -- "HTTP + Basic auth" --> RC
  RC -- HTTPS --> P[(Cloud providers)]
  C --> DB[(SQLite<br/>appData/syncvault.db)]
```

Lifecycle:

1. Main takes the single-instance lock. A second launch only focuses the existing window.
2. Main generates a random socket/pipe name and a random 256-bit auth token, then spawns the core.
3. Core removes a stale socket file (left by a crash), listens (dir `0700`, socket `0600`), opens the DB,
   prints `SYNCVAULT_CORE_READY` on stdout. The vault starts **locked**; rclone is not running yet.
4. When the vault is created, unlocked or recovered, the core derives the rclone config password and starts
   rclone: an empty `rclone.conf` is encrypted first (`rclone config encryption set`, password via
   `--password-command` → `password-helper.mjs`, which prints it from a child-only env var); a non-empty plain
   config is refused. Then the core kills a stale rclone left by a previous crash (PID file + `/proc` cmdline
   check on Linux), picks a free port and random credentials, starts
   `rclone rcd --config <appData>/rclone/rclone.conf` with `RCLONE_CONFIG_PASS` in its env, polls `rc/noop`
   until it answers, then calls `core/version`. `vault.lock` zeroes the key and stops rclone.
5. Main connects, authenticates with `auth.hello`, and reports `connected` to the renderer.
6. If the core exits unexpectedly, main restarts it with exponential backoff (max 5 attempts) and shows the
   error in the UI.
7. Quit: main calls `core.shutdown`; the core calls rclone `core/quit` (SIGTERM / SIGKILL fallback), closes the
   DB and exits. Main kills the core if it does not exit in time. If main dies, the core sees stdin EOF and
   shuts down, so no orphaned rclone remains.

## IPC

- Renderer → main: `ipcRenderer.invoke('syncvault:rpc', method, params)`. Main checks the sender frame,
  checks the method against `RENDERER_ALLOWED_METHODS`, validates params with zod, forwards, and validates the
  result with zod before returning it.
- Main → core: JSON-RPC 2.0, one JSON object per line. Max 1 MiB per message. The first request on every
  connection must be `auth.hello { token }` (constant-time compare); anything else closes the connection.
- Core → rclone: `POST http://127.0.0.1:<port>/<group>/<method>` with JSON body and HTTP Basic auth.
- Main → renderer events: `syncvault:core-state` (`starting | connected | restarting | failed | stopped`).
- Renderer-allowed RPC methods: `status.get` (versions, rclone + DB state), `history.list { limit? }`
  (Activity page, newest first), `accounts.list` and `files.list { accountId, path }` (Files page, read-only),
  and the vault: `vault.status`, `vault.create { password }`, `vault.unlock { password }`,
  `vault.recover { recoveryKey, newPassword }`, `vault.lock`.
  - Vault failures are reason codes (`wrongPassword`, `wrongKey`, …). Request params are never logged.
  - The renderer gates the UI on `vault.status` (none → Welcome, locked → Unlock) and re-checks it on every
    `connected` core state, because a restarted core is locked.
  - `history.list` returns only the folder **name**, never the full local path, and never the free-text `detail` column.
  - `accounts.list` never returns the internal rclone remote name.
  - `files.list`: the renderer sends an **account id**, never an rclone remote; the core looks the remote up in
    SQLite, so the renderer can't make rclone list the local disk. `path` is relative and `/`-separated
    (`isSafeRemotePath`: no `..`, no leading `/`, no `\`). Paths inside an **encrypted** sync folder return
    `{ state: 'encrypted' }` (ciphertext names) until the vault exists. Errors are reason codes, never raw rclone
    messages (they can contain paths). Listings are capped at `FILES_MAX_ENTRIES`.

## Data flow (planned)

File change → chokidar watcher → debounce (3 s) → job enqueued in SQLite → per-folder lock → dry run
(count deletes; pause above 50) → `sync/bisync` with backup dirs and `--max-delete` → history row.

## Where keys and secrets live

| Secret                         | Where                                                                                             |
| ------------------------------ | ------------------------------------------------------------------------------------------------- |
| Recovery key (root secret)     | Shown once to the user; never stored. Vault key = HKDF-SHA256(recovery secret)                    |
| Master password                | Memory only, while unlocking; never on disk                                                       |
| Vault key, derived keys        | Core memory only, while unlocked; zeroed on lock / shutdown                                       |
| Wrapped vault key              | `<appData>/vault.json` (0600): AES-256-GCM under an Argon2id(master password) key                 |
| rclone.conf password           | HKDF(vault key); passed via `RCLONE_CONFIG_PASS` (rcd) or `--password-command` (first encryption) |
| Cloud OAuth tokens, crypt keys | Inside rclone.conf — always encrypted with rclone config encryption                               |
| RPC auth token                 | Memory + core env at spawn time; new on every start                                               |
| rclone rc user/password        | Memory + rclone env at spawn time; new on every start                                             |

## Paths

- App data: Electron `app.getPath('userData')` (Linux: `~/.config/Syncvault`).
- rclone config: `<appData>/rclone/rclone.conf` (Syncvault's own; never the user's).
- Database: `<appData>/syncvault.db`.
- Vault: `<appData>/vault.json` (wrapped key + Argon2id parameters only).
- Socket: `$XDG_RUNTIME_DIR/syncvault/core.sock` (Linux), `<appData>/run/core.sock` (macOS / fallback),
  `\\.\pipe\syncvault-<random>` (Windows).
- Resources: resolved only in `apps/desktop/src/main/paths.ts` (dev → repo paths; packaged →
  `process.resourcesPath`, populated by electron-builder `extraResources`).
