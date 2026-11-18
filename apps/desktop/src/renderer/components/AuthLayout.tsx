import type { ReactNode } from 'react';
import { t } from '../i18n';
import type { StepState } from '../onboarding/flow';

/** Lock icon, as in the website logo. Decorative. */
export const LockIcon = (props: { className?: string }): React.JSX.Element => (
  <svg
    aria-hidden="true"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={2}
    strokeLinecap="round"
    strokeLinejoin="round"
    className={props.className ?? 'size-4 shrink-0'}
  >
    <rect x="5" y="11" width="14" height="10" rx="2" />
    <path d="M8 11V7a4 4 0 0 1 8 0v4" />
  </svg>
);

export const CheckIcon = (props: { className?: string }): React.JSX.Element => (
  <svg
    aria-hidden="true"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={2.5}
    strokeLinecap="round"
    strokeLinejoin="round"
    className={props.className ?? 'size-3 shrink-0'}
  >
    <path d="M5 12.5l4.5 4.5L19 7.5" />
  </svg>
);

const StepMarker = (props: { state: StepState }): React.JSX.Element => {
  switch (props.state) {
    case 'done':
      return (
        <span className="grid size-5 place-items-center rounded-full bg-primary text-white">
          <CheckIcon />
        </span>
      );
    case 'current':
      return (
        <span className="grid size-5 place-items-center rounded-full border-2 border-primary-bright">
          <span className="size-2 rounded-full bg-primary-bright" />
        </span>
      );
    default:
      return <span className="size-5 rounded-full border-2 border-white/40" />;
  }
};

/**
 * Shell for the screens shown before the app opens (setup, unlock): a black brand panel on the left,
 * the form on the right. Fits the window's minimum size (800×560); the form column scrolls if needed.
 */
export const AuthLayout = (props: {
  steps?: { label: string; state: StepState }[];
  children: ReactNode;
}): React.JSX.Element => (
  <div className="flex h-full">
    <aside className="flex w-72 shrink-0 flex-col bg-ink p-8 text-white dark:border-r dark:border-ink-raised">
      <p className="flex items-center gap-2 text-lg font-semibold tracking-tight">
        <span className="grid size-7 place-items-center rounded-full bg-white text-ink">
          <LockIcon className="size-3.5" />
        </span>
        {t('app.name')}
      </p>

      <p className="mt-8 text-xl font-semibold leading-snug">
        {t('auth.taglineStart')} <span className="text-primary-bright">{t('auth.taglineEnd')}</span>
      </p>

      {props.steps && (
        <ol aria-label={t('auth.stepsLabel')} className="mt-10 flex flex-col gap-4">
          {props.steps.map((s) => (
            <li
              key={s.label}
              aria-current={s.state === 'current' ? 'step' : undefined}
              className={`flex items-center gap-3 text-sm ${
                s.state === 'upcoming' ? 'text-white/60' : 'font-medium text-white'
              }`}
            >
              <StepMarker state={s.state} />
              {s.label}
              {s.state === 'done' && <span className="sr-only">{t('auth.stepDone')}</span>}
            </li>
          ))}
        </ol>
      )}

      <p className="mt-auto flex items-start gap-2 pt-8 text-sm text-white/70">
        <LockIcon className="mt-0.5 size-4 shrink-0" />
        {t('auth.privacy')}
      </p>
    </aside>

    <main className="flex flex-1 overflow-y-auto" aria-live="polite">
      <div className="m-auto w-full max-w-md px-8 py-10">{props.children}</div>
    </main>
  </div>
);
