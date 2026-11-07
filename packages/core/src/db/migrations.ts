/**
 * Ordered schema migrations, applied with `PRAGMA user_version`.
 * Never edit a released migration — add a new one.
 */
export interface Migration {
  version: number;
  name: string;
  sql: string;
}

export const migrations: readonly Migration[] = [
  {
    version: 1,
    name: 'initial',
    sql: `
      -- Cloud accounts. Secrets (OAuth tokens) live in the encrypted rclone.conf, never here.
      CREATE TABLE accounts (
        id            TEXT PRIMARY KEY,
        provider      TEXT NOT NULL,
        display_name  TEXT NOT NULL,
        rclone_remote TEXT NOT NULL UNIQUE,
        created_at    INTEGER NOT NULL
      );

      CREATE TABLE sync_folders (
        id               TEXT PRIMARY KEY,
        account_id       TEXT NOT NULL REFERENCES accounts(id),
        local_path       TEXT NOT NULL UNIQUE,
        remote_path      TEXT NOT NULL,
        encrypted        INTEGER NOT NULL DEFAULT 1,
        mode             TEXT NOT NULL DEFAULT 'bisync',
        initial_resync_done INTEGER NOT NULL DEFAULT 0,
        paused           INTEGER NOT NULL DEFAULT 0,
        created_at       INTEGER NOT NULL
      );

      -- Persistent, retry-safe job queue (see docs/DATA-SAFETY.md).
      CREATE TABLE jobs (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        folder_id   TEXT NOT NULL REFERENCES sync_folders(id),
        kind        TEXT NOT NULL,
        state       TEXT NOT NULL DEFAULT 'queued',
        attempts    INTEGER NOT NULL DEFAULT 0,
        last_error  TEXT,
        created_at  INTEGER NOT NULL,
        updated_at  INTEGER NOT NULL
      );
      CREATE INDEX jobs_state_idx ON jobs(state);

      CREATE TABLE history (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        folder_id   TEXT REFERENCES sync_folders(id),
        job_id      INTEGER REFERENCES jobs(id),
        event       TEXT NOT NULL,
        detail      TEXT,
        created_at  INTEGER NOT NULL
      );
    `,
  },
];

export const latestSchemaVersion = (): number => migrations.at(-1)?.version ?? 0;

/** Returns the migrations still to apply for a database at `currentVersion`. */
export const pendingMigrations = (currentVersion: number): readonly Migration[] =>
  migrations.filter((m) => m.version > currentVersion);
