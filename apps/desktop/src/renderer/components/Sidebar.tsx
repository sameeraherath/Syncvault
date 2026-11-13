import { t, type TranslationKey } from '../i18n';

export type PageId = 'welcome' | 'dashboard' | 'files' | 'accounts' | 'activity' | 'settings';

const items: { id: PageId; label: TranslationKey }[] = [
  { id: 'dashboard', label: 'nav.dashboard' },
  { id: 'files', label: 'nav.files' },
  { id: 'accounts', label: 'nav.accounts' },
  { id: 'activity', label: 'nav.activity' },
  { id: 'settings', label: 'nav.settings' },
  { id: 'welcome', label: 'nav.welcome' },
];

export const Sidebar = (props: {
  current: PageId;
  onNavigate: (id: PageId) => void;
}): React.JSX.Element => (
  <nav
    aria-label={t('nav.label')}
    className="flex w-60 flex-col bg-ink p-4 text-white dark:border-r dark:border-ink-raised"
  >
    <div className="mb-6 px-3 pt-2">
      <p className="text-lg font-semibold">{t('app.name')}</p>
      <p className="text-xs text-white/70">{t('app.tagline')}</p>
    </div>
    <ul className="flex flex-col gap-1">
      {items.map((item) => {
        const active = item.id === props.current;
        return (
          <li key={item.id}>
            <button
              type="button"
              aria-current={active ? 'page' : undefined}
              onClick={() => props.onNavigate(item.id)}
              className={`flex min-h-touch w-full items-center rounded-md px-3 text-left text-sm font-medium ${
                active ? 'bg-ink-raised text-primary-bright' : 'text-white/85 hover:bg-ink-raised'
              }`}
            >
              {t(item.label)}
            </button>
          </li>
        );
      })}
    </ul>
  </nav>
);
