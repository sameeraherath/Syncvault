# Syncvault

**All your clouds, in sync. Only you hold the key.**

Syncvault is a free, open-source desktop app that encrypts your files on your own computer
(zero-knowledge) and keeps them in sync with Google Drive, OneDrive, Dropbox and 40+ other services —
across as many accounts as you like.

> 🚧 **Early development — Linux first.** Nothing here is ready for real data yet.

Website: <https://getsyncvault.com>

## Features (planned)

- End-to-end encryption on your device (rclone crypt) — cloud providers only see ciphertext
- Google Drive and OneDrive first, then Dropbox and 40+ more providers
- Multiple accounts per provider
- Automatic two-way sync with backups before anything is deleted or overwritten
- Master password + recovery key; keys never leave memory
- Tray app for Linux (Ubuntu, Fedora); Windows and macOS later
- No telemetry, no analytics, no account with us

## How it works

```
┌──────────────┐  IPC   ┌──────────────┐  JSON-RPC  ┌──────────────┐  HTTP (localhost)  ┌──────────┐      ┌────────────┐
│  UI (React)  │ ─────► │ Electron main│ ─────────► │ Core service │ ─────────────────► │ rclone   │ ───► │ Your clouds│
│  sandboxed   │        │  validates   │  socket    │ queue, DB,   │  random port +     │ rcd +    │      │ (encrypted)│
└──────────────┘        └──────────────┘            │ watchers     │  random credentials│ crypt    │      └────────────┘
                                                    └──────────────┘                    └──────────┘
```

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for details.

## Build from source

Requirements: Node.js (version in `.nvmrc`), Corepack, a C/C++ toolchain (`build-essential` on Ubuntu,
`gcc-c++ make` on Fedora) and Python 3 for building `better-sqlite3`.

```bash
corepack enable            # provides the pinned pnpm version
pnpm install               # also rebuilds native modules for Electron
pnpm fetch:rclone          # downloads + SHA256-verifies the pinned rclone for your platform
pnpm dev                   # opens the app
```

Other commands: `pnpm test`, `pnpm lint`, `pnpm typecheck`, `pnpm build`, `pnpm dist:linux`.
The Rust crate in `crates/vault` is optional for now (`cargo check --manifest-path crates/vault/Cargo.toml`).

### Tray icon on GNOME

Stock GNOME (e.g. Ubuntu without its default extension, Fedora Workstation) does not show tray icons.
Install and enable the **AppIndicator and KStatusNotifierItem Support** extension
(`gnome-shell-extension-appindicator` on Fedora; enabled by default on Ubuntu). Without it, Syncvault keeps
the window usable: closing the window minimises it instead of hiding it to the tray.

### Ubuntu 23.10+ sandbox error in development

If `pnpm dev` aborts with _"The SUID sandbox helper binary was found, but is not configured correctly"_,
see [CONTRIBUTING.md](docs/CONTRIBUTING.md#ubuntu-2310--2404-suid-sandbox-helper--not-configured-correctly).

## Contributing

See [docs/CONTRIBUTING.md](docs/CONTRIBUTING.md). Translations (Sinhala and Tamil first) are very welcome.
Security issues: see [docs/SECURITY.md](docs/SECURITY.md).

## Sponsor

_Placeholder — sponsorship options coming soon._

## Licence

[GPL-3.0](LICENSE). IBM Plex fonts are under the SIL Open Font License 1.1.
