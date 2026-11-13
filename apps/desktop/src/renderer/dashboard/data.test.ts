import { describe, expect, it } from 'vitest';
import type { HistoryEntry } from '@syncvault/shared';
import {
  lastSyncAt,
  overallState,
  todayEntries,
  type FolderState,
  type SyncFolderSummary,
} from './data';
import { mockDashboardData } from './mockDashboard';

const folder = (state: FolderState, last: number | null = null): SyncFolderSummary => ({
  id: state,
  name: state,
  encrypted: true,
  state,
  lastSyncAt: last,
});

describe('overallState', () => {
  it('is empty without folders', () => {
    expect(overallState([])).toBe('empty');
  });

  it('is ok when every folder is ok', () => {
    expect(overallState([folder('ok'), folder('ok')])).toBe('ok');
  });

  it.each<[FolderState[], FolderState]>([
    [['ok', 'syncing'], 'syncing'],
    [['syncing', 'paused', 'ok'], 'paused'],
    [['paused', 'error', 'syncing'], 'error'],
  ])('worst state wins: %j → %s', (states, expected) => {
    expect(overallState(states.map((s) => folder(s)))).toBe(expected);
  });
});

describe('lastSyncAt', () => {
  it('returns the newest sync time, ignoring never-synced folders', () => {
    expect(lastSyncAt([folder('ok', 10), folder('error'), folder('ok', 30)])).toBe(30);
  });

  it('is null when nothing has synced', () => {
    expect(lastSyncAt([])).toBeNull();
    expect(lastSyncAt([folder('error')])).toBeNull();
  });
});

describe('todayEntries', () => {
  const entry = (id: number, createdAt: number): HistoryEntry => ({
    id,
    event: 'sync.completed',
    folderName: 'Work',
    createdAt,
  });

  it('keeps only entries since local midnight', () => {
    const now = new Date(2026, 10, 13, 9, 0);
    const midnight = new Date(2026, 10, 13).getTime();
    const kept = todayEntries(
      [entry(3, now.getTime()), entry(2, midnight), entry(1, midnight - 1)],
      now,
    );
    expect(kept.map((e) => e.id)).toEqual([3, 2]);
  });
});

describe('demo data', () => {
  it('shows only today in the activity list', () => {
    const now = new Date(2026, 10, 13, 12, 0).getTime();
    const { today } = mockDashboardData(now);
    expect(today.length).toBeGreaterThan(0);
    expect(today.every((e) => e.createdAt >= new Date(2026, 10, 13).getTime())).toBe(true);
  });

  it('covers every folder state and an unencrypted folder', () => {
    const { folders } = mockDashboardData(0);
    expect(new Set(folders.map((f) => f.state))).toEqual(
      new Set(['ok', 'syncing', 'paused', 'error']),
    );
    expect(folders.some((f) => !f.encrypted)).toBe(true);
  });
});
