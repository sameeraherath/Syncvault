import { createRequire } from 'node:module';
import type BetterSqlite3 from 'better-sqlite3';
import { pendingMigrations } from './migrations.js';

export type Database = BetterSqlite3.Database;

/**
 * Opens (creating if needed) the Syncvault database and applies migrations.
 * better-sqlite3 is loaded with require() so it resolves from node_modules at runtime
 * (it is a native module rebuilt for Electron's ABI and is not bundled).
 */
export const openDatabase = (file: string): { db: Database; schemaVersion: number } => {
  const require = createRequire(import.meta.url);
  const Sqlite = require('better-sqlite3') as typeof BetterSqlite3;
  const db = new Sqlite(file);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  const current = db.pragma('user_version', { simple: true }) as number;
  for (const m of pendingMigrations(current)) {
    db.transaction(() => {
      db.exec(m.sql);
      db.pragma(`user_version = ${m.version}`);
    })();
  }
  return { db, schemaVersion: db.pragma('user_version', { simple: true }) as number };
};
