import { PrimaryButton } from '../components/Page';
import { t } from '../i18n';
import { StepHeading } from './StepParts';

export const IntroStep = (props: { onStart: () => void }): React.JSX.Element => (
  <div className="text-center">
    <StepHeading>{t('pages.welcome.title')}</StepHeading>
    <p className="mb-6 text-text-muted dark:text-white/70">{t('pages.welcome.body')}</p>
    <PrimaryButton onClick={props.onStart}>{t('pages.welcome.cta')}</PrimaryButton>
  </div>
);
