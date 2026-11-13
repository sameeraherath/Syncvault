import {
  FILES_MAX_ENTRIES,
  ok,
  type Account,
  type FileEntry,
  type FileListResult,
} from '@syncvault/shared';
import type { FilesSource } from './source';

/**
 * DEMO DATA — development builds only. Loaded with a dynamic import behind `import.meta.env.DEV`
 * in pages/Files.tsx, so production builds don't contain this file. All names are fake.
 * Covers every UI state: nested folders, encrypted + unencrypted sync folders, a huge folder
 * (truncated), an empty folder and an account that fails to list.
 */

type MockNode =
  | { dir: true; children: Record<string, MockNode>; syncFolder?: { encrypted: boolean } }
  | { dir: false; size: number; modTime: number };

const T = Date.UTC(2026, 10, 10, 8, 30); // 10 Nov 2026
const DAY = 86_400_000;

const f = (size: number, daysAgo = 0): MockNode => ({
  dir: false,
  size,
  modTime: T - daysAgo * DAY,
});
const d = (
  children: Record<string, MockNode> = {},
  syncFolder?: { encrypted: boolean },
): MockNode => (syncFolder ? { dir: true, children, syncFolder } : { dir: true, children });

const bigFolder = Object.fromEntries(
  Array.from({ length: 2500 }, (_, i) => [
    `scan-${String(i + 1).padStart(4, '0')}.pdf`,
    f(180_000 + i, i % 30),
  ]),
);

export const MOCK_ACCOUNTS: Account[] = [
  { id: 'demo-personal', provider: 'drive', displayName: 'Personal (demo)' },
  { id: 'demo-work', provider: 'onedrive', displayName: 'Work (demo)' },
  { id: 'demo-school', provider: 'onedrive', displayName: 'School (demo, broken)' },
];

export const MOCK_TREES: Record<string, MockNode> = {
  'demo-personal': d({
    Photos: d({
      '2025': d({
        Holiday: d({ 'beach.jpg': f(3_400_000, 300), 'sunset.jpg': f(2_900_000, 299) }),
        'birthday.jpg': f(1_800_000, 200),
      }),
      '2026': d({ 'new-year.jpg': f(2_100_000, 314) }),
    }),
    Work: d({ 'a7Fq9x2k...': f(1024) }, { encrypted: true }),
    'Taxes 2026': d(
      { 'receipts.pdf': f(540_000, 12), 'summary.xlsx': f(48_000, 3) },
      { encrypted: false },
    ),
    'notes.txt': f(1_240, 1),
    'budget.xlsx': f(86_000, 7),
  }),
  'demo-work': d({
    Projects: d({
      Apollo: d({ 'plan.docx': f(320_000, 20), 'timeline.xlsx': f(64_000, 2) }),
      Website: d({ 'brief.pdf': f(1_200_000, 40) }),
    }),
    'Scanned documents': d(bigFolder),
    'Empty folder': d(),
  }),
};

const toEntries = (children: Record<string, MockNode>): FileEntry[] =>
  Object.entries(children)
    .map(([name, node]): FileEntry =>
      node.dir
        ? { name, isDir: true, size: null, modTime: null, syncFolder: node.syncFolder ?? null }
        : { name, isDir: false, size: node.size, modTime: node.modTime, syncFolder: null },
    )
    .sort((a, b) =>
      a.isDir !== b.isDir
        ? a.isDir
          ? -1
          : 1
        : a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }),
    );

/** Same rules as the real core: encrypted folders can't be opened, unknown paths fail. */
export const mockListFiles = (accountId: string, path: string): FileListResult => {
  let node = MOCK_TREES[accountId];
  if (!node)
    return {
      state: 'error',
      reason: accountId === 'demo-school' ? 'listFailed' : 'accountNotFound',
    };
  for (const segment of path === '' ? [] : path.split('/')) {
    if (!node.dir) return { state: 'error', reason: 'listFailed' };
    const next: MockNode | undefined = node.children[segment];
    if (!next) return { state: 'error', reason: 'listFailed' };
    if (next.dir && next.syncFolder?.encrypted) return { state: 'encrypted' };
    node = next;
  }
  if (!node.dir) return { state: 'error', reason: 'listFailed' };
  const entries = toEntries(node.children);
  return {
    state: 'ok',
    entries: entries.slice(0, FILES_MAX_ENTRIES),
    truncated: entries.length > FILES_MAX_ENTRIES,
  };
};

const delay = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

export const mockSource: FilesSource = {
  listAccounts: async () => {
    await delay(300); // so the loading state is visible
    return ok(MOCK_ACCOUNTS);
  },
  listFiles: async (accountId, path) => {
    await delay(300);
    return ok(mockListFiles(accountId, path));
  },
};
