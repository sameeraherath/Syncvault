import { DATA_SAFETY_DEFAULTS } from '@syncvault/shared';

/**
 * Sync orchestration — NOT IMPLEMENTED YET. Read docs/DATA-SAFETY.md before writing code here.
 *
 * TODO(sync):
 *  - Job queue persisted in SQLite (`jobs` table); idempotent, safe to retry after a crash.
 *  - One lock per sync folder: never two jobs on the same folder concurrently.
 *  - Debounce watcher events (DATA_SAFETY_DEFAULTS.debounceMs) before enqueueing.
 *  - Dry run first; if deletes > DATA_SAFETY_DEFAULTS.maxDeleteFiles, pause and ask the user.
 *  - bisync with --backup-dir1 (local) + --backup-dir2 (same remote as path2) and
 *    --max-delete DATA_SAFETY_DEFAULTS.bisyncMaxDeletePercent (a percentage).
 *  - First run requires --resync; record `initial_resync_done`. Never auto-resync on errors.
 *  - Never touch rclone's bisync lock/listing files.
 */

export type SyncJobKind = 'bisync' | 'sync' | 'copy';

export interface SyncJob {
  id: number;
  folderId: string;
  kind: SyncJobKind;
  attempts: number;
}

export const SYNC_DEFAULTS = DATA_SAFETY_DEFAULTS;
