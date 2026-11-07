import { EmptyState, PageHeader } from '../components/Page';
import { t } from '../i18n';

// TODO(ui): history from the core (SQLite `history` table).
export const ActivityPage = (): React.JSX.Element => (
  <>
    <PageHeader title={t('pages.activity.title')} />
    <EmptyState text={t('pages.activity.empty')} />
  </>
);
