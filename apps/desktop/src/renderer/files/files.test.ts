import { describe, expect, it } from 'vitest';
import { FILES_MAX_ENTRIES, isSafeRemotePath, rpcMethods } from '@syncvault/shared';
import { childPath, formatBytes, pathPrefixes } from './format';
import { MOCK_ACCOUNTS, MOCK_TREES, mockListFiles } from './mockFiles';

describe('formatBytes', () => {
  it.each([
    [0, '0 byte'],
    [512, '512 byte'],
    [1024, '1 kB'],
    [1536, '1.5 kB'],
    [3_400_000, '3.2 MB'],
    [5 * 1024 ** 3, '5 GB'],
  ])('formats %d', (bytes, expected) => {
    expect(formatBytes(bytes, 'en-US')).toBe(expected);
  });
});

describe('paths', () => {
  it('builds breadcrumb prefixes', () => {
    expect(pathPrefixes('')).toEqual([]);
    expect(pathPrefixes('Photos/2025')).toEqual([
      { name: 'Photos', path: 'Photos' },
      { name: '2025', path: 'Photos/2025' },
    ]);
  });

  it('joins child paths', () => {
    expect(childPath('', 'Photos')).toBe('Photos');
    expect(childPath('Photos', '2025')).toBe('Photos/2025');
  });
});

// The demo data must look exactly like real core responses, so mock and real can't drift apart.
describe('demo data', () => {
  const result = rpcMethods['files.list'].result;

  it('accounts match the accounts.list schema', () => {
    expect(rpcMethods['accounts.list'].result.safeParse({ accounts: MOCK_ACCOUNTS }).success).toBe(
      true,
    );
  });

  it('every folder listing matches the files.list schema and every path is safe', () => {
    const walk = (accountId: string, path: string): void => {
      const listing = mockListFiles(accountId, path);
      expect(result.safeParse(listing).success).toBe(true);
      if (listing.state !== 'ok') return;
      for (const e of listing.entries) {
        const p = childPath(path, e.name);
        expect(isSafeRemotePath(p)).toBe(true);
        if (e.isDir) walk(accountId, p);
      }
    };
    for (const id of Object.keys(MOCK_TREES)) walk(id, '');
  });

  it('covers the special UI states', () => {
    expect(mockListFiles('demo-personal', 'Work')).toEqual({ state: 'encrypted' });
    expect(mockListFiles('demo-school', '')).toMatchObject({ state: 'error' });
    expect(mockListFiles('demo-work', 'Empty folder')).toEqual({
      state: 'ok',
      entries: [],
      truncated: false,
    });
    const big = mockListFiles('demo-work', 'Scanned documents');
    expect(big).toMatchObject({ state: 'ok', truncated: true });
    if (big.state === 'ok') expect(big.entries).toHaveLength(FILES_MAX_ENTRIES);
  });
});
