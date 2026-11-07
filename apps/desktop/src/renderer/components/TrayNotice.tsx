import { useEffect, useState } from 'react';
import { t } from '../i18n';

export const TrayNotice = (): React.JSX.Element | null => {
  const [available, setAvailable] = useState(true);
  useEffect(() => {
    void window.syncvault.isTrayAvailable().then(setAvailable);
  }, []);
  if (available) return null;
  return (
    <div role="status" className="mb-6 rounded-lg bg-warning-bg p-4 text-sm text-warning-text">
      <p className="font-semibold">{t('tray_notice.title')}</p>
      <p>{t('tray_notice.body')}</p>
    </div>
  );
};
