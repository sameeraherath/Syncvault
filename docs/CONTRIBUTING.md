# Contributing to Syncvault

Thank you for helping! Please read [CLAUDE.md](../CLAUDE.md), [SECURITY.md](SECURITY.md) and
[DATA-SAFETY.md](DATA-SAFETY.md) first — the rules there apply to every change.

## Setup

```bash
corepack enable
pnpm install          # rebuilds better-sqlite3 for Electron's ABI (postinstall)
pnpm fetch:rclone     # pinned rclone, SHA256-verified
pnpm dev
```

Linux build deps: `build-essential python3` (Ubuntu) or `gcc-c++ make python3` (Fedora).
Rust (for `crates/vault`) is optional for now.

If you change the Electron version or see `NODE_MODULE_VERSION` errors from better-sqlite3, run
`pnpm rebuild:native`.

### Ubuntu 23.10+ / 24.04: "SUID sandbox helper … not configured correctly"

Ubuntu restricts unprivileged user namespaces with AppArmor, so Chromium falls back to the SUID sandbox
helper (`node_modules/electron/dist/chrome-sandbox`), which must be owned by root with mode `4755`. That is
impossible on some filesystems (e.g. NTFS/exFAT drives). Preferred fix — an AppArmor profile that allows
user namespaces for the dev Electron binary only (run from the repo root):

```bash
ELECTRON_BIN="$(pwd)/node_modules/electron/dist/electron"
printf 'abi <abi/4.0>,\ninclude <tunables/global>\nprofile syncvault-dev-electron "%s" flags=(unconfined) {\n  userns,\n}\n' \
  "$ELECTRON_BIN" | sudo tee /etc/apparmor.d/syncvault-dev-electron
sudo apparmor_parser -r /etc/apparmor.d/syncvault-dev-electron
```

Alternatively, if the repo is on ext4/btrfs:
`sudo chown root:root node_modules/electron/dist/chrome-sandbox && sudo chmod 4755 node_modules/electron/dist/chrome-sandbox`.

Last resort, **development only**: `pnpm dev:no-sandbox` runs Chromium without its OS-level sandbox.
Never use it outside local development and never ship it.

## Branch naming

`feat/<short-name>`, `fix/<short-name>`, `docs/…`, `chore/…`, `refactor/…`, `test/…`, `i18n/<lang>`.

## Commits

[Conventional Commits](https://www.conventionalcommits.org/): `feat(core): add job queue table`,
`fix(desktop): …`, `docs: …`, `chore: …`. Scopes: `desktop`, `core`, `shared`, `vault`, `scripts`, `ci`, `i18n`.

## Pull request checklist

- [ ] `pnpm typecheck && pnpm lint && pnpm test` pass
- [ ] Small, focused change with a clear description
- [ ] No weakening of security or data-safety rules
- [ ] Tests for anything that deletes, moves or overwrites files
- [ ] No new dependency without prior discussion
- [ ] UI strings in `locales/en.json`, not hard-coded; accessible (keyboard, labels, ≥ 44 px targets)
- [ ] Docs updated if architecture changed
- [ ] No secrets, rclone binaries, databases or user data committed

## Translations

Translations are very welcome — **Sinhala (`si`) and Tamil (`ta`) first**. Copy
`apps/desktop/src/renderer/locales/en.json` to `<lang>.json` and translate the values (keep the keys).
