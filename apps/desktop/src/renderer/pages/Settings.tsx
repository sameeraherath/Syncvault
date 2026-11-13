import { useState } from 'react';
import { Card, PageHeader } from '../components/Page';
import { StatusCard } from '../components/StatusCard';
import { t } from '../i18n';
import {
  applyTheme,
  loadThemePreference,
  saveThemePreference,
  type ThemePreference,
} from '../theme';

const options: { value: ThemePreference; label: Parameters<typeof t>[0] }[] = [
  { value: 'system', label: 'pages.settings.themeSystem' },
  { value: 'light', label: 'pages.settings.themeLight' },
  { value: 'dark', label: 'pages.settings.themeDark' },
];

export const SettingsPage = (): React.JSX.Element => {
  const [theme, setTheme] = useState<ThemePreference>(loadThemePreference);

  const choose = (value: ThemePreference): void => {
    setTheme(value);
    saveThemePreference(value);
    applyTheme(value);
  };

  return (
    <>
      <PageHeader title={t('pages.settings.title')} />
      <Card className="mb-6">
        <fieldset>
          <legend className="mb-3 font-semibold">{t('pages.settings.theme')}</legend>
          <div className="flex gap-2">
            {options.map((o) => (
              <label
                key={o.value}
                className={`flex min-h-touch cursor-pointer items-center gap-2 rounded-md border px-4 text-sm ${
                  theme === o.value
                    ? 'border-primary bg-primary-light text-primary-text'
                    : 'border-border dark:border-ink'
                }`}
              >
                <input
                  type="radio"
                  name="theme"
                  value={o.value}
                  checked={theme === o.value}
                  onChange={() => choose(o.value)}
                  className="accent-primary"
                />
                {t(o.label)}
              </label>
            ))}
          </div>
        </fieldset>
      </Card>
      <div className="mb-6">
        <StatusCard />
      </div>
      <Card>
        <button
          type="button"
          onClick={() => void window.syncvault.openExternal('https://getsyncvault.com')}
          className="min-h-touch text-sm font-medium text-primary-text underline dark:text-primary-bright"
        >
          {t('pages.settings.website')}
        </button>
      </Card>
    </>
  );
};
