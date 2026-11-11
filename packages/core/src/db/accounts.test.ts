import { describe, expect, it } from 'vitest';
import { listAccounts, toAccount } from './accounts.js';
import { freshTestDb, insertAccount } from './test-db.js';

describe('listAccounts', () => {
  it('returns an empty list when nothing is linked', () => {
    expect(listAccounts(freshTestDb())).toEqual([]);
  });

  it('orders by display name, case-insensitively', () => {
    const db = freshTestDb();
    insertAccount(db, { id: 'a', provider: 'onedrive', displayName: 'work', remote: 'sv-a' });
    insertAccount(db, { id: 'b', provider: 'drive', displayName: 'Personal', remote: 'sv-b' });
    expect(listAccounts(db).map((a) => a.displayName)).toEqual(['Personal', 'work']);
  });

  it('never exposes the internal rclone remote name', () => {
    const db = freshTestDb();
    insertAccount(db, {
      id: 'a',
      provider: 'drive',
      displayName: 'Personal',
      remote: 'sv-secret-remote',
    });
    const out = listAccounts(db);
    expect(out).toEqual([{ id: 'a', provider: 'drive', displayName: 'Personal' }]);
    expect(JSON.stringify(out)).not.toContain('sv-secret-remote');
  });

  it('skips providers it does not know', () => {
    const db = freshTestDb();
    insertAccount(db, { id: 'a', provider: 'dropbox', displayName: 'Later', remote: 'sv-a' });
    insertAccount(db, { id: 'b', provider: 'drive', displayName: 'Now', remote: 'sv-b' });
    expect(listAccounts(db).map((a) => a.id)).toEqual(['b']);
  });

  it('rejects malformed rows', () => {
    expect(toAccount(null)).toBeNull();
    expect(toAccount({ id: '', provider: 'drive', display_name: 'x' })).toBeNull();
  });
});
