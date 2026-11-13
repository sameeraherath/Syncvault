import {
  HISTORY_MAX_LIMIT,
  err,
  ok,
  type Account,
  type HistoryEntry,
  type Result,
} from '@syncvault/shared';

/**
 * Dashboard data. Pure logic + the data-source interface (no React) so it can be unit-tested in Node.
 * `SyncFolderSummary` is renderer-local for now; it moves to @syncvault/shared as a zod schema once
 * the core has a `folders.list` RPC.
 */

export type FolderState = 'ok' | 'syncing' | 'paused' | 'error';

export interface SyncFolderSummary {
  id: string;
  /** Folder name only — never a full local path. */
  name: string;
  encrypted: boolean;
  state: FolderState;
  /** Unix epoch milliseconds of the last successful sync, or null if never synced. */
  lastSyncAt: number | null;
}

export type OverallState = 'empty' | FolderState;

/** Worst state wins: error > paused > syncing > ok. No folders → 'empty'. */
const PRIORITY: readonly FolderState[] = ['error', 'paused', 'syncing', 'ok'];

export const overallState = (folders: readonly SyncFolderSummary[]): OverallState => {
  if (folders.length === 0) return 'empty';
  return PRIORITY.find((s) => folders.some((f) => f.state === s)) ?? 'ok';
};

/** Newest successful sync across all folders, or null. */
export const lastSyncAt = (folders: readonly SyncFolderSummary[]): number | null =>
  folders.reduce<number | null>(
    (latest, f) =>
      f.lastSyncAt !== null && (latest === null || f.lastSyncAt > latest) ? f.lastSyncAt : latest,
    null,
  );

/** Entries from today (local time), newest first as given. */
export const todayEntries = (
  entries: readonly HistoryEntry[],
  now = new Date(),
): HistoryEntry[] => {
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  return entries.filter((e) => e.createdAt >= startOfDay);
};

export interface DashboardData {
  accounts: Account[];
  /** Drives the status line; the list itself is not shown on the Dashboard. */
  folders: SyncFolderSummary[];
  /** Today's activity, newest first. */
  today: HistoryEntry[];
}

/** Where the Dashboard gets its data: the real core, or dev-only demo data (mockDashboard.ts). */
export interface DashboardSource {
  load(): Promise<Result<DashboardData, string>>;
}

export const rpcDashboardSource: DashboardSource = {
  load: async () => {
    const [accounts, history] = await Promise.all([
      window.syncvault.rpc('accounts.list'),
      window.syncvault.rpc('history.list', { limit: HISTORY_MAX_LIMIT }),
    ]);
    if (!accounts.ok) return err(accounts.error.message);
    if (!history.ok) return err(history.error.message);
    // The core has no sync folders yet (no `folders.list` RPC).
    return ok({
      accounts: accounts.value.accounts,
      folders: [],
      today: todayEntries(history.value.entries),
    });
  },
};
