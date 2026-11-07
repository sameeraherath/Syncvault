import { StatusCard } from '../components/StatusCard';
import { PageHeader } from '../components/Page';
import { t } from '../i18n';

export const DashboardPage = (): React.JSX.Element => (
  <>
    <PageHeader title={t('pages.dashboard.title')} />
    <StatusCard />
  </>
);
