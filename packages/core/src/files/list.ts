import { z } from 'zod';
import {
  FILES_MAX_ENTRIES,
  isSafeRemotePath,
  type FileEntry,
  type FileListResult,
} from '@syncvault/shared';
import type { QueryableDb } from '../db/queryable.js';
import type { RcloneClient } from '../rclone/client.js';

/** Read-only folder listing inside a linked cloud account (rclone `operations/list`). */

export interface ListFilesDeps {
  db: QueryableDb;
  /** null while rclone is not running. */
  rclone: Pick<RcloneClient, 'call'> | null;
}

export interface ListFilesParams {
  accountId: string;
  /** Already validated by the shared `remotePathSchema`; re-checked here (defence in depth). */
  path: string;
}

/** Only names we generate ourselves; anything else could be a local path or a connection string. */
const REMOTE_NAME_RE = /^[A-Za-z0-9_-]{1,64}$/;

const accountRowSchema = z.object({ rclone_remote: z.string() });
const folderRowSchema = z.object({ remote_path: z.string(), encrypted: z.number().int() });

const rcloneListSchema = z.object({
  list: z.array(
    z.object({
      Name: z.string(),
      IsDir: z.boolean(),
      Size: z.number(),
      ModTime: z.string().optional(),
    }),
  ),
});

const trimSlashes = (p: string): string => p.replace(/^\/+|\/+$/g, '');
const isInside = (path: string, folder: string): boolean =>
  path === folder || path.startsWith(`${folder}/`);
const joinPath = (dir: string, name: string): string => (dir === '' ? name : `${dir}/${name}`);

const parseModTime = (raw: string | undefined): number | null => {
  if (raw === undefined) return null;
  const ms = Date.parse(raw);
  return Number.isFinite(ms) ? ms : null;
};

const byFoldersThenName = (a: FileEntry, b: FileEntry): number =>
  a.isDir !== b.isDir
    ? a.isDir
      ? -1
      : 1
    : a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' });

export const listFiles = async (
  deps: ListFilesDeps,
  params: ListFilesParams,
): Promise<FileListResult> => {
  if (!isSafeRemotePath(params.path)) return { state: 'error', reason: 'listFailed' };

  // 1. The renderer only sends an account id; the rclone remote comes from our own DB.
  const account = accountRowSchema.safeParse(
    deps.db.prepare('SELECT rclone_remote FROM accounts WHERE id = ?').all(params.accountId)[0],
  );
  if (!account.success || !REMOTE_NAME_RE.test(account.data.rclone_remote)) {
    return { state: 'error', reason: 'accountNotFound' };
  }

  const folders = deps.db
    .prepare('SELECT remote_path, encrypted FROM sync_folders WHERE account_id = ?')
    .all(params.accountId)
    .map((row) => folderRowSchema.safeParse(row))
    .filter((r) => r.success)
    .map((r) => ({ path: trimSlashes(r.data.remote_path), encrypted: r.data.encrypted === 1 }));

  // 2. Inside an encrypted sync folder the names are ciphertext — don't show them.
  //    TODO(vault): list through the crypt remote once the vault is unlocked.
  if (folders.some((f) => f.encrypted && f.path !== '' && isInside(params.path, f.path))) {
    return { state: 'encrypted' };
  }

  if (!deps.rclone) return { state: 'error', reason: 'rcloneUnavailable' };

  // 3. List. Raw rclone errors are not forwarded: they can contain paths.
  const res = await deps.rclone.call(
    'operations/list',
    { fs: `${account.data.rclone_remote}:`, remote: params.path },
    rcloneListSchema,
  );
  if (!res.ok) {
    return {
      state: 'error',
      reason:
        res.error.code === 'network' || res.error.code === 'timeout'
          ? 'rcloneUnavailable'
          : 'listFailed',
    };
  }

  // 4. Map, mark sync folders, sort, cap.
  const entries = res.value.list
    .filter((item) => item.Name !== '' && isSafeRemotePath(item.Name) && !item.Name.includes('/'))
    .map((item): FileEntry => {
      const full = joinPath(params.path, item.Name);
      const folder = item.IsDir ? folders.find((f) => f.path === full) : undefined;
      return {
        name: item.Name,
        isDir: item.IsDir,
        size: !item.IsDir && item.Size >= 0 ? Math.trunc(item.Size) : null,
        modTime: parseModTime(item.ModTime),
        syncFolder: folder ? { encrypted: folder.encrypted } : null,
      };
    })
    .sort(byFoldersThenName);

  return {
    state: 'ok',
    entries: entries.slice(0, FILES_MAX_ENTRIES),
    truncated: entries.length > FILES_MAX_ENTRIES,
  };
};
