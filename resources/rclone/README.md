# Bundled rclone binaries

Downloaded by `pnpm fetch:rclone` (see `scripts/fetch-rclone.mjs`) — **never committed**.

Layout: `resources/rclone/<platform>-<arch>/rclone[.exe]` using Node's `process.platform` /
`process.arch` names (`linux-x64`, `linux-arm64`, `win32-x64`, `darwin-x64`, `darwin-arm64`).
The pinned version lives in `scripts/rclone-version.json`.
