/**
 * The tiny slice of a SQLite connection the query modules need. better-sqlite3 (the app) and
 * node:sqlite (tests — better-sqlite3 is built for Electron's ABI) both satisfy it.
 */
export interface QueryableDb {
  prepare(sql: string): { all(...params: unknown[]): unknown[] };
}
