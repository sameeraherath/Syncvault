# Data safety

Syncvault touches people's only copy of their files. A sync bug can delete years of photos on every device
at once. These rules are **non-negotiable**; if a feature seems to require breaking one, stop and discuss it
in an issue first. Defaults live in `DATA_SAFETY_DEFAULTS` in `packages/shared/src/constants.ts`.

## 1. Never delete or overwrite without a backup

- **bisync** (two-way): always pass
  - `--backup-dir1 <local backup dir>` — for files changed/deleted on the local side (path1), and
  - `--backup-dir2 <remote:backup dir>` — for the cloud side (path2). It **must be on the same remote as
    path2**, otherwise rclone rejects it (or would have to copy across remotes).
- **One-way sync / copy**: pass `--backup-dir <remote:dir>` on the destination remote.
- Backup directories must not be inside the synced path (rclone refuses overlapping paths; we check first).

## 2. Two delete safety checks

They are different and we keep **both**:

| Check                  | Owner         | Unit                    | Default | Behaviour                                                                                                                             |
| ---------------------- | ------------- | ----------------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| Syncvault delete limit | Syncvault     | number of files         | 50      | Before a real run, do a `--dry-run` and count deletes. If more than N, pause the job and ask the user to confirm.                     |
| `--max-delete`         | rclone bisync | **percentage** of files | 50 %    | bisync aborts if more than this percentage of files would be deleted on either side. Never disable it; never pass `--force` silently. |

## 3. One lock per sync folder

Never run two jobs on the same sync folder at the same time (watcher-triggered sync, manual "Sync now",
retry after crash…). The job queue takes a per-folder lock before running and releases it on completion or
failure.

## 4. Debounce file events

Batch file-system events for **3 seconds** (default) after the last event before queueing a sync, so that
editors writing temp files or copying large folders do not trigger dozens of runs.

## 5. First bisync needs `--resync`

The first bisync between two paths has no listings yet and requires `--resync`. Handle this explicitly:
the folder record stores whether the initial resync completed. Never add `--resync` automatically to recover
from errors — a resync after a failure can resurrect deleted files or, worse, propagate a bad state. Ask the
user instead.

## 6. Respect rclone's lock and listing files

bisync keeps listing (`*.lst`) and lock (`*.lck`) files in its working directory. Never delete them
manually. If a lock is stale (e.g. after a crash), use rclone's `--max-lock` / documented recovery path and
surface it to the user.

## 7. Persistent, idempotent job queue

Jobs are stored in SQLite before they run, so a crash or power loss does not lose them. Every job must be
safe to run twice (sync/bisync are idempotent by nature; any extra steps such as moves must check state
first).

## 8. Tests

Any code that deletes, moves, or overwrites files needs tests — including the failure path (backup dir
missing, delete limit exceeded, lock held, first run without resync). Unit tests must not need the rclone
binary or network: mock the rclone client.
