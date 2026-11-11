import { useEffect, useState } from 'react';
import type { Account } from '@syncvault/shared';
import { PageHeader } from '../components/Page';
import type { PageId } from '../components/Sidebar';
import { DriveList } from '../files/DriveList';
import { FolderView } from '../files/FolderView';
import { rpcSource, type FilesSource } from '../files/source';
import { useCoreState } from '../hooks/useCoreState';
import { t } from '../i18n';

/**
 * Demo data exists only in development builds. In production `import.meta.env.DEV` is the constant
 * `false`, so Vite removes this dynamic import and files/mockFiles.ts is never bundled.
 */
const loadDemoSource: (() => Promise<FilesSource>) | null = import.meta.env.DEV
  ? async () => (await import('../files/mockFiles')).mockSource
  : null;

type Location = { account: Account; path: string } | null;

// Read-only file-manager view of linked clouds. TODO(ui): rename/move/delete (phase 2, needs backups).
export const FilesPage = (props: { onNavigate: (id: PageId) => void }): React.JSX.Element => {
  const core = useCoreState();
  const [demo, setDemo] = useState(loadDemoSource !== null);
  const [demoSource, setDemoSource] = useState<FilesSource | null>(null);
  const [location, setLocation] = useState<Location>(null);

  useEffect(() => {
    if (!demo || demoSource || !loadDemoSource) return;
    void loadDemoSource().then(setDemoSource);
  }, [demo, demoSource]);

  const source = demo ? demoSource : rpcSource;
  const ready = demo ? demoSource !== null : core.state === 'connected';

  const toggleDemo = (on: boolean): void => {
    setDemo(on);
    setLocation(null);
  };

  return (
    <>
      <PageHeader title={t('pages.files.title')} />

      {loadDemoSource && (
        <div className="mb-6 flex flex-wrap items-center gap-4 rounded-md bg-warning-bg p-3 text-sm text-warning-text">
          <label className="flex min-h-touch cursor-pointer items-center gap-2 font-medium">
            <input
              type="checkbox"
              checked={demo}
              onChange={(e) => toggleDemo(e.target.checked)}
              className="size-4"
            />
            {t('pages.files.demo.toggle')}
          </label>
          {demo && <span>{t('pages.files.demo.notice')}</span>}
        </div>
      )}

      {source &&
        (location === null ? (
          <DriveList
            key={demo ? 'demo' : 'real'}
            source={source}
            ready={ready}
            onOpen={(account) => setLocation({ account, path: '' })}
            onAddAccount={() => props.onNavigate('accounts')}
          />
        ) : (
          <FolderView
            key={`${demo ? 'demo' : 'real'}:${location.account.id}:${location.path}`}
            source={source}
            account={location.account}
            path={location.path}
            onNavigate={(path) => setLocation({ account: location.account, path })}
            onExit={() => setLocation(null)}
          />
        ))}
    </>
  );
};
