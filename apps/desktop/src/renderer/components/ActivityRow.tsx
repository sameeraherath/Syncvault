import type { HistoryEntry, HistoryEvent } from '@syncvault/shared';
import { t } from '../i18n';

// Failures in error colours, "paused, needs review" in warning orange; blue stays for actions only.
const toneClass = (event: HistoryEvent): string => {
  switch (event) {
    case 'sync.failed':
      return 'border-l-error-text';
    case 'sync.paused':
      return 'border-l-warning-text';
    default:
      return 'border-l-border dark:border-l-ink';
  }
};

const dateTimeFormat = new Intl.DateTimeFormat(undefined, {
  dateStyle: 'medium',
  timeStyle: 'short',
});
const timeFormat = new Intl.DateTimeFormat(undefined, { timeStyle: 'short' });

/** One activity entry. `timeOnly` for lists that are already limited to one day. */
export const ActivityRow = (props: {
  entry: HistoryEntry;
  timeOnly?: boolean;
}): React.JSX.Element => {
  const { entry } = props;
  const date = new Date(entry.createdAt);
  return (
    <li
      className={`flex flex-wrap items-baseline gap-x-4 gap-y-1 border-l-4 py-3 pl-4 ${toneClass(entry.event)}`}
    >
      <time
        dateTime={date.toISOString()}
        className={`${props.timeOnly ? 'w-20' : 'w-44'} shrink-0 text-sm text-text-muted dark:text-white/70`}
      >
        {(props.timeOnly ? timeFormat : dateTimeFormat).format(date)}
      </time>
      <span className="font-medium">{t(`pages.activity.events.${entry.event}`)}</span>
      {entry.folderName !== null && <span className="font-mono text-sm">{entry.folderName}</span>}
    </li>
  );
};
