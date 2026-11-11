import { useEffect, useRef } from 'react';
import { t } from '../i18n';

/**
 * Step title. Receives focus when the step appears so keyboard and screen-reader
 * users land at the top of the new step instead of on a button that disappeared.
 */
export const StepHeading = (props: { children: string }): React.JSX.Element => {
  const ref = useRef<HTMLHeadingElement>(null);
  useEffect(() => ref.current?.focus(), []);
  return (
    <h1 ref={ref} tabIndex={-1} className="mb-2 text-2xl font-semibold focus:outline-none">
      {props.children}
    </h1>
  );
};

/** Orange (warning), never red: shown while the vault is still a mock. */
export const PreviewNotice = (): React.JSX.Element => (
  <p className="mb-6 rounded-md bg-warning-bg p-3 text-sm text-warning-text">
    {t('pages.welcome.previewNotice')}
  </p>
);
