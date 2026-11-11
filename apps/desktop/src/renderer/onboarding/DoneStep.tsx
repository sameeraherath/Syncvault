import { PrimaryButton } from '../components/Page';
import { t } from '../i18n';
import { StepHeading } from './StepParts';

export const DoneStep = (props: { onAddAccount: () => void }): React.JSX.Element => (
  <div className="text-center">
    <StepHeading>{t('pages.welcome.done.title')}</StepHeading>
    <p className="mb-6 text-text-muted dark:text-white/70">{t('pages.welcome.done.body')}</p>
    <PrimaryButton onClick={props.onAddAccount}>{t('pages.welcome.done.addAccount')}</PrimaryButton>
  </div>
);
