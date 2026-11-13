import { ok, type HistoryEntry } from '@syncvault/shared';
import { MOCK_ACCOUNTS } from '../files/mockFiles';
import { todayEntries, type DashboardData, type DashboardSource } from './data';

/**
 * DEMO DATA — development builds only. Loaded with a dynamic import behind `import.meta.env.DEV`
 * in pages/Dashboard.tsx, so production builds don't contain this file. All names are fake.
 * One folder per state (drives the status line) and a day of activity, plus one entry from
 * yesterday that the "today" filter must drop.
 */

const MIN = 60_000;

const mockHistory = (now: number): HistoryEntry[] => [
  { id: 6, event: 'sync.completed', folderName: 'Work', createdAt: now - 2 * MIN },
  { id: 5, event: 'sync.failed', folderName: 'Thesis', createdAt: now - 12 * MIN },
  { id: 4, event: 'sync.paused', folderName: 'Taxes 2026', createdAt: now - 31 * MIN },
  { id: 3, event: 'folder.added', folderName: 'Photos', createdAt: now - 46 * MIN },
  { id: 2, event: 'account.added', folderName: null, createdAt: now - 50 * MIN },
  { id: 1, event: 'sync.completed', folderName: 'Work', createdAt: now - 30 * 60 * MIN },
];

export const mockDashboardData = (now = Date.now()): DashboardData => ({
  accounts: MOCK_ACCOUNTS,
  folders: [
    { id: 'demo-1', name: 'Work', encrypted: true, state: 'ok', lastSyncAt: now - 2 * MIN },
    { id: 'demo-2', name: 'Photos', encrypted: true, state: 'syncing', lastSyncAt: null },
    {
      id: 'demo-3',
      name: 'Taxes 2026',
      encrypted: false,
      state: 'paused',
      lastSyncAt: now - 30 * 60 * MIN,
    },
    { id: 'demo-4', name: 'Thesis', encrypted: true, state: 'error', lastSyncAt: null },
  ],
  today: todayEntries(mockHistory(now), new Date(now)),
});

export const mockDashboardSource: DashboardSource = {
  load: () => Promise.resolve(ok(mockDashboardData())),
};
