import { watch, type FSWatcher } from 'chokidar';
import { DATA_SAFETY_DEFAULTS } from '@syncvault/shared';

/**
 * Folder watching — skeleton only, not wired up yet.
 *
 * TODO(watch):
 *  - Debounce events per folder (DATA_SAFETY_DEFAULTS.debounceMs) and enqueue a sync job.
 *  - Linux: handle inotify watch limit (ENOSPC / fs.inotify.max_user_watches) and tell the user.
 *  - Ignore Syncvault's own backup dirs and rclone working files.
 *  - Never log full paths at info level.
 */
export interface FolderWatcherOptions {
  path: string;
  onChange: () => void;
}

export const createFolderWatcher = (opts: FolderWatcherOptions): FSWatcher => {
  const watcher = watch(opts.path, {
    ignoreInitial: true,
    awaitWriteFinish: { stabilityThreshold: 1000, pollInterval: 200 },
  });
  watcher.on('all', () => opts.onChange());
  return watcher;
};

export const WATCH_DEBOUNCE_MS = DATA_SAFETY_DEFAULTS.debounceMs;
