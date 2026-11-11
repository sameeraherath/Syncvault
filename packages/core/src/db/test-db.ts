import { DatabaseSync } from 'node:sqlite';
import { migrations } from './migrations.js';

/**
 * Test helper: an in-memory database with the real migrations applied.
 * Uses Node's built-in SQLite because better-sqlite3 is compiled for Electron's ABI.
 */
export const freshTestDb = (): DatabaseSync => {
  const db = new DatabaseSync(':memory:');
  for (const m of migrations) db.exec(m.sql);
  return db;
};

export const insertAccount = (
  db: DatabaseSync,
  a: { id: string; provider: string; displayName: string; remote: string },
): void => {
  db.prepare(
    'INSERT INTO accounts (id, provider, display_name, rclone_remote, created_at) VALUES (?, ?, ?, ?, 0)',
  ).run(a.id, a.provider, a.displayName, a.remote);
};

export const insertSyncFolder = (
  db: DatabaseSync,
  f: { id: string; accountId: string; localPath: string; remotePath: string; encrypted: boolean },
): void => {
  db.prepare(
    `INSERT INTO sync_folders (id, account_id, local_path, remote_path, encrypted, created_at)
     VALUES (?, ?, ?, ?, ?, 0)`,
  ).run(f.id, f.accountId, f.localPath, f.remotePath, f.encrypted ? 1 : 0);
};
