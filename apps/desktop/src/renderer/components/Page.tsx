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

export const PrimaryButton = (props: {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
}): React.JSX.Element => (
  <button
    type="button"
    onClick={props.onClick}
    disabled={props.disabled}
    className="min-h-touch rounded-md bg-primary px-4 text-sm font-medium text-white hover:bg-primary-hover disabled:opacity-50"
  >
    {props.children}
  </button>
);

export const EmptyState = (props: { text: string }): React.JSX.Element => (
  <Card>
    <p className="text-text-muted dark:text-white/70">{props.text}</p>
  </Card>
);
