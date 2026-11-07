# Roadmap

Dates are intentionally absent — this is a volunteer-driven project.

## 0. Scaffold (current)

- [x] Monorepo, CI, docs, security and data-safety rules
- [x] Electron window + tray, core service over authenticated JSON-RPC, rclone rcd started and queried

## MVP — Linux (Ubuntu, Fedora)

- Vault: master password (Argon2id) + recovery key, keys in memory, OS keychain (Secret Service)
- Encrypted rclone.conf (config password from the vault)
- Accounts: Google Drive + OneDrive, multiple accounts each
- Sync folders: encrypted by default (rclone crypt), automatic two-way sync (bisync) with all data-safety checks
- Tray, notifications, Activity history
- Screens: Welcome, Dashboard, Sync folders, Add account, New sync folder, Activity, Settings
- Packaging: AppImage + .deb (+ .rpm), auto-update

## v1.0 — Windows

- Named-pipe IPC hardening, Windows Credential Manager, installer (NSIS/MSIX), code signing

## v1.x — macOS

- Keychain, notarised .dmg, Apple Silicon + Intel

## Later

- Dropbox and more providers in the UI (rclone already supports 40+)
- Mount mode (on-demand files)
- Mobile companion
- Sharing
- Teams / organisations
