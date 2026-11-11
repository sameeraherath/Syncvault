import { z } from 'zod';
import { providerSchema, type Account } from '@syncvault/shared';
import type { QueryableDb } from './queryable.js';

const rowSchema = z.object({
  id: z.string().min(1),
  provider: z.string(),
  display_name: z.string(),
});

// `rclone_remote` is deliberately not selected: it is an internal name the renderer never needs.
const LIST_SQL = `SELECT id, provider, display_name FROM accounts ORDER BY display_name COLLATE NOCASE, id`;

/** Rows with an unknown provider (e.g. added by a newer version) are skipped, not fatal. */
export const toAccount = (row: unknown): Account | null => {
  const r = rowSchema.safeParse(row);
  if (!r.success) return null;
  const provider = providerSchema.safeParse(r.data.provider);
  if (!provider.success) return null;
  return { id: r.data.id, provider: provider.data, displayName: r.data.display_name };
};

export const listAccounts = (db: QueryableDb): Account[] =>
  db
    .prepare(LIST_SQL)
    .all()
    .map(toAccount)
    .filter((a): a is Account => a !== null);
