import { EmptyState, PageHeader, PrimaryButton } from '../components/Page';
import { t } from '../i18n';

// TODO(ui): list sync folders (paths in font-mono), encryption badge, "New sync folder" flow.
export const SyncFoldersPage = (): React.JSX.Element => (
  <>
    <PageHeader
      title={t('pages.syncFolders.title')}
      action={<PrimaryButton disabled>{t('pages.syncFolders.add')}</PrimaryButton>}
    />
    <EmptyState text={t('pages.syncFolders.empty')} />
  </>
);
