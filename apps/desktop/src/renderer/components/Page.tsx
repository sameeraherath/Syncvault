import type { ReactNode } from 'react';

export const PageHeader = (props: { title: string; action?: ReactNode }): React.JSX.Element => (
  <header className="mb-6 flex items-center justify-between">
    <h1 className="text-2xl font-semibold">{props.title}</h1>
    {props.action}
  </header>
);

export const Card = (props: { children: ReactNode; className?: string }): React.JSX.Element => (
  <section
    className={`rounded-xl border border-border bg-card p-6 dark:border-ink-raised dark:bg-ink-raised ${props.className ?? ''}`}
  >
    {props.children}
  </section>
);

interface ButtonProps {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  /** Use 'submit' inside a <form> so Enter submits it. */
  type?: 'button' | 'submit';
}

export const PrimaryButton = (props: ButtonProps): React.JSX.Element => (
  <button
    type={props.type ?? 'button'}
    onClick={props.onClick}
    disabled={props.disabled}
    className="min-h-touch rounded-md bg-primary px-4 text-sm font-medium text-white hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-50"
  >
    {props.children}
  </button>
);

/** Low-emphasis action (e.g. Back). Still blue: blue is the only action colour. */
export const SecondaryButton = (props: ButtonProps): React.JSX.Element => (
  <button
    type={props.type ?? 'button'}
    onClick={props.onClick}
    disabled={props.disabled}
    className="min-h-touch rounded-md px-4 text-sm font-medium text-primary-text hover:bg-primary-light disabled:cursor-not-allowed disabled:opacity-50 dark:text-primary-bright dark:hover:bg-ink"
  >
    {props.children}
  </button>
);

export const EmptyState = (props: { text: string }): React.JSX.Element => (
  <Card>
    <p className="text-text-muted dark:text-white/70">{props.text}</p>
  </Card>
);
