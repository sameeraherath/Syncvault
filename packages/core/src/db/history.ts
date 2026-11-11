import path from 'node:path';
import { z } from 'zod';
import { HISTORY_DEFAULT_LIMIT, historyEventSchema, type HistoryEntry } from '@syncvault/shared';
import type { QueryableDb } from './queryable.js';

const rowSchema = z.object({
  id: z.number().int().positive(),
  event: z.string(),
  created_at: z.number().int().nonnegative(),
  local_path: z.string().nullable(),
});

// `detail` is deliberately not selected: it may hold paths or error text later.
const LIST_SQL = `
  SELECT h.id, h.event, h.created_at, f.local_path
  FROM history h
  LEFT JOIN sync_folders f ON f.id = h.folder_id
  ORDER BY h.created_at DESC, h.id DESC
  LIMIT ?
`;

/**
 * Maps a raw row to an entry. Returns null for rows the renderer can't show
 * (malformed, or an event added by a newer version) instead of failing the whole list.
 * Only the folder *name* leaves the core, never the full local path.
 */
export const toHistoryEntry = (row: unknown): HistoryEntry | null => {
  const r = rowSchema.safeParse(row);
  if (!r.success) return null;
  const event = historyEventSchema.safeParse(r.data.event);
  if (!event.success) return null;
  return {
    id: r.data.id,
    event: event.data,
    folderName: r.data.local_path === null ? null : path.basename(r.data.local_path),
    createdAt: r.data.created_at,
  };
};

/** Newest entries first. */
export const listHistory = (db: QueryableDb, limit = HISTORY_DEFAULT_LIMIT): HistoryEntry[] =>
  db
    .prepare(LIST_SQL)
    .all(limit)
    .map(toHistoryEntry)
    .filter((e): e is HistoryEntry => e !== null);
