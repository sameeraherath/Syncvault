import { Card, PrimaryButton } from '../components/Page';
import { t } from '../i18n';

// TODO(ui): first-run flow — master password + recovery key, then Add account.
export const WelcomePage = (): React.JSX.Element => (
  <Card className="mx-auto max-w-xl text-center">
    <h1 className="mb-2 text-2xl font-semibold">{t('pages.welcome.title')}</h1>
    <p className="mb-6 text-text-muted dark:text-white/70">{t('pages.welcome.body')}</p>
    <PrimaryButton disabled>{t('pages.welcome.cta')}</PrimaryButton>
    <p className="mt-2 text-xs text-text-muted dark:text-white/70">{t('common.comingSoon')}</p>
  </Card>
);
