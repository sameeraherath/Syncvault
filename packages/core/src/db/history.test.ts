import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';
import { listHistory, toHistoryEntry } from './history.js';
import { migrations } from './migrations.js';

// better-sqlite3 is compiled for Electron's ABI, so tests use Node's built-in SQLite
// with the real migration SQL.
const freshDb = (): DatabaseSync => {
  const db = new DatabaseSync(':memory:');
  for (const m of migrations) db.exec(m.sql);
  return db;
};

const LOCAL_PATH = path.join('home', 'someone', 'private', 'Work');

const seedFolder = (db: DatabaseSync): void => {
  db.prepare(
    `INSERT INTO accounts (id, provider, display_name, rclone_remote, created_at)
     VALUES ('acc1', 'drive', 'Personal', 'sv-acc1', 0)`,
  ).run();
  db.prepare(
    `INSERT INTO sync_folders (id, account_id, local_path, remote_path, created_at)
     VALUES ('f1', 'acc1', ?, 'Syncvault/Work', 0)`,
  ).run(LOCAL_PATH);
};

const addEvent = (db: DatabaseSync, event: string, createdAt: number, folderId?: string): void => {
  db.prepare('INSERT INTO history (folder_id, event, detail, created_at) VALUES (?, ?, ?, ?)').run(
    folderId ?? null,
    event,
    'secret detail',
    createdAt,
  );
};

describe('listHistory', () => {
  let db: DatabaseSync;
  beforeEach(() => {
    db = freshDb();
  });

  it('returns an empty list for an empty table', () => {
    expect(listHistory(db)).toEqual([]);
  });

  it('returns newest first, breaking ties by id', () => {
    addEvent(db, 'account.added', 100);
    addEvent(db, 'sync.completed', 300);
    addEvent(db, 'sync.failed', 200);
    addEvent(db, 'sync.paused', 300);
    expect(listHistory(db).map((e) => e.event)).toEqual([
      'sync.paused',
      'sync.completed',
      'sync.failed',
      'account.added',
    ]);
  });

  it('respects the limit', () => {
    for (let i = 0; i < 5; i++) addEvent(db, 'sync.completed', i);
    expect(listHistory(db, 2)).toHaveLength(2);
  });

  it('exposes only the folder name, never the full path or detail', () => {
    seedFolder(db);
    addEvent(db, 'folder.added', 1, 'f1');
    addEvent(db, 'account.added', 2);
    const [account, folder] = listHistory(db);
    expect(folder).toEqual({ id: 1, event: 'folder.added', folderName: 'Work', createdAt: 1 });
    expect(account?.folderName).toBeNull();
    expect(JSON.stringify(listHistory(db))).not.toContain('private');
    expect(JSON.stringify(listHistory(db))).not.toContain('secret');
  });

  it('skips events it does not know instead of failing', () => {
    addEvent(db, 'from.a.newer.version', 2);
    addEvent(db, 'sync.completed', 1);
    expect(listHistory(db).map((e) => e.event)).toEqual(['sync.completed']);
  });
});

describe('toHistoryEntry', () => {
  it('rejects malformed rows', () => {
    expect(toHistoryEntry(null)).toBeNull();
    expect(
      toHistoryEntry({ id: 'x', event: 'sync.completed', created_at: 1, local_path: null }),
    ).toBeNull();
  });
});
