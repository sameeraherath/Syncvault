import { useCallback, useEffect, useState } from 'react';
import type { CoreState, Result, RpcErrorObject, StatusGetResult } from '@syncvault/shared';
import { useCoreState } from '../hooks/useCoreState';
import { t } from '../i18n';
import { Card, PrimaryButton } from './Page';

const coreLabel = (s: CoreState): string => {
  switch (s.state) {
    case 'restarting':
      return t('status.core.restarting', { attempt: s.attempt, max: s.maxAttempts });
    default:
      return t(`status.core.${s.state}`);
  }
};

const rcloneLabel = (status: StatusGetResult | null): string => {
  if (!status) return t('status.unknown');
  const r = status.rclone;
  switch (r.state) {
    case 'running':
      return r.version;
    case 'error':
      return `${t('status.rclone.error')}: ${r.message}`;
    default:
      return t(`status.rclone.${r.state}`);
  }
};

const dbLabel = (status: StatusGetResult | null): string => {
  if (!status) return t('status.unknown');
  const d = status.database;
  return d.state === 'ready'
    ? t('status.db.ready', { version: d.schemaVersion })
    : `${t('status.db.error')}: ${d.message}`;
};

export const StatusCard = (): React.JSX.Element => {
  const core = useCoreState();
  const [status, setStatus] = useState<StatusGetResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const apply = useCallback((res: Result<StatusGetResult, RpcErrorObject>) => {
    if (res.ok) {
      setStatus(res.value);
      setError(null);
    } else {
      setError(res.error.message);
    }
  }, []);
  const refresh = useCallback(() => void window.syncvault.rpc('status.get').then(apply), [apply]);

  useEffect(() => {
    if (core.state !== 'connected') return;
    refresh();
    // Poll until rclone has finished starting; later this becomes a push notification.
    const timer = setInterval(refresh, 2000);
    return () => clearInterval(timer);
  }, [core.state, refresh]);

  const coreBad = core.state === 'failed' || core.state === 'restarting';
  const rows: [string, string, boolean?][] = [
    [t('status.appVersion'), status?.appVersion ?? t('status.unknown')],
    [t('status.rcloneVersion'), rcloneLabel(status), status?.rclone.state === 'error'],
    [t('status.coreService'), coreLabel(core), coreBad],
    [t('status.database'), dbLabel(status), status?.database.state === 'error'],
  ];

  return (
    <Card>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold">{t('status.title')}</h2>
        <PrimaryButton onClick={refresh} disabled={core.state !== 'connected'}>
          {t('status.refresh')}
        </PrimaryButton>
      </div>
      <dl className="grid grid-cols-[max-content_1fr] gap-x-8 gap-y-3 text-sm">
        {rows.map(([label, value, bad]) => (
          <div key={label} className="contents">
            <dt className="text-text-muted dark:text-white/70">{label}</dt>
            <dd className={bad ? 'rounded bg-error-bg px-2 text-error-text' : 'font-medium'}>
              {value}
            </dd>
          </div>
        ))}
      </dl>
      {(error || core.state === 'failed') && (
        <p role="alert" className="mt-4 rounded-md bg-error-bg p-3 text-sm text-error-text">
          {core.state === 'failed' ? core.message : error}
        </p>
      )}
    </Card>
  );
};
