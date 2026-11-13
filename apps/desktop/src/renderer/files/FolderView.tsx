import { useEffect, useRef, useState } from 'react';
import type { Account, FileEntry, FileListResult } from '@syncvault/shared';
import { Card, PrimaryButton, SecondaryButton } from '../components/Page';
import { t } from '../i18n';
import { childPath, formatBytes, formatDate, pathPrefixes } from './format';
import { FileIcon, FolderIcon, LockIcon } from './icons';
import type { FilesSource } from './source';

type Load = { state: 'loading' } | { state: 'failed'; message: string } | FileListResult;

const SyncBadge = (props: { encrypted: boolean }): React.JSX.Element =>
  props.encrypted ? (
    <span className="inline-flex items-center gap-1 rounded-full bg-primary-light px-2 py-0.5 text-xs font-medium text-primary-text dark:bg-ink dark:text-primary-bright">
      <LockIcon />
      {t('pages.files.syncedEncrypted')}
    </span>
  ) : (
    // "Not encrypted" is a warning: orange, never red.
    <span className="inline-flex items-center rounded-full bg-warning-bg px-2 py-0.5 text-xs font-medium text-warning-text">
      {t('pages.files.syncedNotEncrypted')}
    </span>
  );

const Row = (props: { entry: FileEntry; onOpen: () => void }): React.JSX.Element => {
  const { entry } = props;
  const meta = (
    <>
      <span className="w-24 shrink-0 text-right text-sm text-text-muted tabular-nums dark:text-white/70">
        {entry.size !== null ? formatBytes(entry.size) : ''}
      </span>
      <span className="w-28 shrink-0 text-right text-sm text-text-muted dark:text-white/70">
        {entry.modTime !== null ? formatDate(entry.modTime) : ''}
      </span>
    </>
  );
  const name = (
    <span className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
      <span className="truncate">{entry.name}</span>
      {entry.syncFolder && <SyncBadge encrypted={entry.syncFolder.encrypted} />}
    </span>
  );
  return (
    <li>
      {entry.isDir ? (
        <button
          type="button"
          onClick={props.onOpen}
          aria-label={`${t('pages.files.folder')}: ${entry.name}`}
          className="flex min-h-touch w-full items-center gap-3 rounded-md px-3 text-left hover:bg-primary-light dark:hover:bg-ink"
        >
          <FolderIcon />
          {name}
          {meta}
        </button>
      ) : (
        <div className="flex min-h-touch items-center gap-3 px-3">
          <FileIcon />
          {name}
          {meta}
        </div>
      )}
    </li>
  );
};

/**
 * One folder of one account. The parent remounts this per path (via `key`), so each folder starts
 * in the loading state and the heading takes focus for keyboard users.
 */
export const FolderView = (props: {
  source: FilesSource;
  account: Account;
  path: string;
  onNavigate: (path: string) => void;
  onExit: () => void;
}): React.JSX.Element => {
  const { source, account, path } = props;
  const [load, setLoad] = useState<Load>({ state: 'loading' });
  const [attempt, setAttempt] = useState(0);
  const heading = useRef<HTMLHeadingElement>(null);

  useEffect(() => heading.current?.focus(), []);

  useEffect(() => {
    let live = true;
    void source.listFiles(account.id, path).then((res) => {
      if (live) setLoad(res.ok ? res.value : { state: 'failed', message: res.error });
    });
    return () => {
      live = false;
    };
  }, [source, account.id, path, attempt]);

  const retry = (): void => {
    setLoad({ state: 'loading' });
    setAttempt((n) => n + 1);
  };

  const crumbs = pathPrefixes(path);
  const here = crumbs.at(-1)?.name ?? account.displayName;

  return (
    <div>
      <nav aria-label={t('pages.files.breadcrumb')} className="mb-4">
        <ol className="flex flex-wrap items-center gap-1 text-sm">
          <li>
            <SecondaryButton onClick={props.onExit}>{t('pages.files.root')}</SecondaryButton>
          </li>
          <li aria-hidden="true">›</li>
          <li>
            {crumbs.length === 0 ? (
              <span aria-current="page" className="px-2 font-medium">
                {account.displayName}
              </span>
            ) : (
              <SecondaryButton onClick={() => props.onNavigate('')}>
                {account.displayName}
              </SecondaryButton>
            )}
          </li>
          {crumbs.map((c, i) => (
            <li key={c.path} className="flex items-center gap-1">
              <span aria-hidden="true">›</span>
              {i === crumbs.length - 1 ? (
                <span aria-current="page" className="px-2 font-medium">
                  {c.name}
                </span>
              ) : (
                <SecondaryButton onClick={() => props.onNavigate(c.path)}>{c.name}</SecondaryButton>
              )}
            </li>
          ))}
        </ol>
      </nav>

      <div className="mb-4 flex items-center justify-between gap-4">
        <h2
          ref={heading}
          tabIndex={-1}
          className="truncate text-xl font-semibold focus:outline-none"
        >
          {here}
        </h2>
        {path !== '' && (
          // TODO(ui): opens the "New sync folder" flow for this folder.
          <span className="flex items-center gap-2">
            <span className="text-xs text-text-muted dark:text-white/70">
              {t('common.comingSoon')}
            </span>
            <PrimaryButton disabled>{t('pages.files.syncThisFolder')}</PrimaryButton>
          </span>
        )}
      </div>

      {load.state === 'loading' && (
        <Card>
          <p className="text-text-muted dark:text-white/70">{t('pages.files.loading')}</p>
        </Card>
      )}

      {(load.state === 'failed' || load.state === 'error') && (
        <div
          role="alert"
          className="flex items-center justify-between gap-4 rounded-md bg-error-bg p-3 text-sm text-error-text"
        >
          <span>
            {load.state === 'error'
              ? t(`pages.files.errors.${load.reason}`)
              : t('pages.files.errors.generic', { message: load.message })}
          </span>
          <SecondaryButton onClick={retry}>{t('pages.files.retry')}</SecondaryButton>
        </div>
      )}

      {load.state === 'encrypted' && (
        <Card>
          <p className="mb-1 flex items-center gap-2 font-semibold">
            <LockIcon />
            {t('pages.files.encrypted.title')}
          </p>
          <p className="text-text-muted dark:text-white/70">{t('pages.files.encrypted.body')}</p>
        </Card>
      )}

      {load.state === 'ok' && (
        <Card className="p-2">
          {load.entries.length === 0 ? (
            <p className="p-4 text-text-muted dark:text-white/70">{t('pages.files.emptyFolder')}</p>
          ) : (
            <ul aria-label={here} className="flex flex-col">
              {load.entries.map((entry) => (
                <Row
                  key={entry.name}
                  entry={entry}
                  onOpen={() => props.onNavigate(childPath(path, entry.name))}
                />
              ))}
            </ul>
          )}
          {load.truncated && (
            <p className="m-2 rounded-md bg-warning-bg p-3 text-sm text-warning-text">
              {t('pages.files.truncated', { count: load.entries.length.toLocaleString() })}
            </p>
          )}
        </Card>
      )}
    </div>
  );
};
