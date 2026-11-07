import { EmptyState, PageHeader, PrimaryButton } from '../components/Page';
import { t } from '../i18n';

// TODO(ui): Add account flow (Google Drive, OneDrive) via rclone OAuth.
export const AccountsPage = (): React.JSX.Element => (
  <>
    <PageHeader
      title={t('pages.accounts.title')}
      action={<PrimaryButton disabled>{t('pages.accounts.add')}</PrimaryButton>}
    />
    <EmptyState text={t('pages.accounts.empty')} />
  </>
);
