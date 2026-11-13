import { describe, expect, it, vi } from 'vitest';
import { FILES_MAX_ENTRIES, err, ok, type Result } from '@syncvault/shared';
import { freshTestDb, insertAccount, insertSyncFolder } from '../db/test-db.js';
import type { RcloneError } from '../rclone/client.js';
import { listFiles, type ListFilesDeps } from './list.js';

type Item = { Name: string; IsDir: boolean; Size: number; ModTime?: string };
type FakeCall = (
  method: string,
  params: Record<string, unknown>,
) => Promise<Result<unknown, RcloneError>>;

const setup = (items: Item[] = []) => {
  const db = freshTestDb();
  insertAccount(db, { id: 'a1', provider: 'drive', displayName: 'Personal', remote: 'sv-a1' });
  const call = vi.fn<FakeCall>(async () => ok({ list: items }));
  // The real `call` is generic over its zod schema; a fake can't express that, hence the cast.
  const rclone = { call } as unknown as NonNullable<ListFilesDeps['rclone']>;
  return { db, call, deps: { db, rclone } satisfies ListFilesDeps };
};

const dir = (Name: string): Item => ({ Name, IsDir: true, Size: -1 });
const file = (Name: string, Size = 10): Item => ({
  Name,
  IsDir: false,
  Size,
  ModTime: '2026-11-10T08:30:00Z',
});

describe('listFiles', () => {
  it('asks rclone for the remote resolved from the DB, never from the caller', async () => {
    const { deps, call } = setup();
    await listFiles(deps, { accountId: 'a1', path: 'Work/2026' });
    expect(call).toHaveBeenCalledTimes(1);
    expect(call.mock.calls[0]?.[0]).toBe('operations/list');
    expect(call.mock.calls[0]?.[1]).toEqual({ fs: 'sv-a1:', remote: 'Work/2026' });
  });

  it('returns accountNotFound for an unknown account without calling rclone', async () => {
    const { deps, call } = setup();
    expect(await listFiles(deps, { accountId: 'nope', path: '' })).toEqual({
      state: 'error',
      reason: 'accountNotFound',
    });
    expect(call).not.toHaveBeenCalled();
  });

  it.each(['/', '/home/someone', 'C:\\Users', 'remote:with:colons', 'a b'])(
    'refuses an unsafe stored remote name %j',
    async (remote) => {
      const { db, deps, call } = setup();
      insertAccount(db, { id: 'bad', provider: 'drive', displayName: 'Bad', remote });
      expect(await listFiles(deps, { accountId: 'bad', path: '' })).toMatchObject({
        reason: 'accountNotFound',
      });
      expect(call).not.toHaveBeenCalled();
    },
  );

  it.each(['..', 'Work/../..', '/etc', 'a\\b', 'x\u0000y'])(
    'refuses an unsafe path %j without calling rclone',
    async (path) => {
      const { deps, call } = setup();
      expect((await listFiles(deps, { accountId: 'a1', path })).state).toBe('error');
      expect(call).not.toHaveBeenCalled();
    },
  );

  it('blocks browsing inside an encrypted sync folder', async () => {
    const { db, deps, call } = setup();
    insertSyncFolder(db, {
      id: 'f1',
      accountId: 'a1',
      localPath: '/home/someone/Work',
      remotePath: 'Syncvault/Work',
      encrypted: true,
    });
    expect(await listFiles(deps, { accountId: 'a1', path: 'Syncvault/Work' })).toEqual({
      state: 'encrypted',
    });
    expect(await listFiles(deps, { accountId: 'a1', path: 'Syncvault/Work/deep' })).toEqual({
      state: 'encrypted',
    });
    expect(call).not.toHaveBeenCalled();
    // A sibling whose name merely starts the same is not inside it.
    expect((await listFiles(deps, { accountId: 'a1', path: 'Syncvault/Workshop' })).state).toBe(
      'ok',
    );
  });

  it('marks sync folders and whether they are encrypted', async () => {
    const { db, deps } = setup([dir('Work'), dir('Taxes'), dir('Photos')]);
    insertSyncFolder(db, {
      id: 'f1',
      accountId: 'a1',
      localPath: '/l/w',
      remotePath: 'Work',
      encrypted: true,
    });
    insertSyncFolder(db, {
      id: 'f2',
      accountId: 'a1',
      localPath: '/l/t',
      remotePath: '/Taxes/',
      encrypted: false,
    });
    const res = await listFiles(deps, { accountId: 'a1', path: '' });
    if (res.state !== 'ok') throw new Error(res.state);
    expect(Object.fromEntries(res.entries.map((e) => [e.name, e.syncFolder]))).toEqual({
      Photos: null,
      Taxes: { encrypted: false },
      Work: { encrypted: true },
    });
  });

  it('sorts folders first, then names naturally', async () => {
    const { deps } = setup([
      file('b.txt'),
      dir('Zeta'),
      file('file10.txt'),
      dir('alpha'),
      file('file2.txt'),
    ]);
    const res = await listFiles(deps, { accountId: 'a1', path: '' });
    if (res.state !== 'ok') throw new Error(res.state);
    expect(res.entries.map((e) => e.name)).toEqual([
      'alpha',
      'Zeta',
      'b.txt',
      'file2.txt',
      'file10.txt',
    ]);
  });

  it('maps sizes and dates; folders have no size', async () => {
    const { deps } = setup([dir('Docs'), file('a.txt', 1234)]);
    const res = await listFiles(deps, { accountId: 'a1', path: '' });
    if (res.state !== 'ok') throw new Error(res.state);
    expect(res.entries).toEqual([
      { name: 'Docs', isDir: true, size: null, modTime: null, syncFolder: null },
      {
        name: 'a.txt',
        isDir: false,
        size: 1234,
        modTime: Date.parse('2026-11-10T08:30:00Z'),
        syncFolder: null,
      },
    ]);
  });

  it('caps very large folders and says so', async () => {
    const many = Array.from({ length: FILES_MAX_ENTRIES + 5 }, (_, i) => file(`f${i}.txt`));
    const { deps } = setup(many);
    const res = await listFiles(deps, { accountId: 'a1', path: '' });
    if (res.state !== 'ok') throw new Error(res.state);
    expect(res.entries).toHaveLength(FILES_MAX_ENTRIES);
    expect(res.truncated).toBe(true);
  });

  it('reports rcloneUnavailable when rclone is not running', async () => {
    const { db } = setup();
    expect(await listFiles({ db, rclone: null }, { accountId: 'a1', path: '' })).toEqual({
      state: 'error',
      reason: 'rcloneUnavailable',
    });
  });

  it('maps rclone failures to codes and never forwards the raw message', async () => {
    const { deps, call } = setup();
    call.mockResolvedValueOnce(
      err({ code: 'http', status: 500, message: 'directory not found: /secret/path' }),
    );
    const res = await listFiles(deps, { accountId: 'a1', path: 'Gone' });
    expect(res).toEqual({ state: 'error', reason: 'listFailed' });
    expect(JSON.stringify(res)).not.toContain('secret');

    call.mockResolvedValueOnce(err({ code: 'timeout', message: 'timeout' }));
    expect(await listFiles(deps, { accountId: 'a1', path: '' })).toMatchObject({
      reason: 'rcloneUnavailable',
    });
  });
});
