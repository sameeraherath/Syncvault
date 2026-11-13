/** Small decorative icons (aria-hidden: the row text already says what it is). */

const base = 'size-5 shrink-0';

export const FolderIcon = (): React.JSX.Element => (
  <svg
    aria-hidden="true"
    viewBox="0 0 24 24"
    className={`${base} text-primary`}
    fill="currentColor"
  >
    <path d="M3 6.5A1.5 1.5 0 0 1 4.5 5h4.38a1.5 1.5 0 0 1 1.06.44L11.5 7h8A1.5 1.5 0 0 1 21 8.5v9a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 17.5z" />
  </svg>
);

export const FileIcon = (): React.JSX.Element => (
  <svg
    aria-hidden="true"
    viewBox="0 0 24 24"
    className={`${base} text-text-muted dark:text-white/60`}
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
  >
    <path d="M7 3h7l5 5v12a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z" />
    <path d="M14 3v5h5" />
  </svg>
);

export const LockIcon = (): React.JSX.Element => (
  <svg
    aria-hidden="true"
    viewBox="0 0 24 24"
    className="size-4"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
  >
    <rect x="5" y="11" width="14" height="9" rx="2" />
    <path d="M8 11V8a4 4 0 0 1 8 0v3" />
  </svg>
);

export const CloudIcon = (): React.JSX.Element => (
  <svg
    aria-hidden="true"
    viewBox="0 0 24 24"
    className="size-8 text-primary"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
  >
    <path d="M7 18a4 4 0 0 1-.5-7.97A6 6 0 0 1 18 9a4.5 4.5 0 0 1-.5 9z" />
  </svg>
);
