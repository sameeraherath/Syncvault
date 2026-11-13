/** Display helpers for the Files page. Units and dates come from Intl, so they follow the user's locale. */

const UNITS = ['byte', 'kilobyte', 'megabyte', 'gigabyte', 'terabyte'] as const;

export const formatBytes = (bytes: number, locale?: string): string => {
  let value = Math.max(0, bytes);
  let unit = 0;
  while (value >= 1024 && unit < UNITS.length - 1) {
    value /= 1024;
    unit++;
  }
  return new Intl.NumberFormat(locale, {
    style: 'unit',
    unit: UNITS[unit],
    unitDisplay: 'short',
    maximumFractionDigits: unit === 0 ? 0 : 1,
  }).format(value);
};

export const formatDate = (ms: number, locale?: string): string =>
  new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(new Date(ms));

/** "Photos/2025/Holiday" → ["Photos", "Photos/2025", "Photos/2025/Holiday"] for breadcrumbs. */
export const pathPrefixes = (path: string): { name: string; path: string }[] =>
  path === ''
    ? []
    : path.split('/').map((name, i, all) => ({ name, path: all.slice(0, i + 1).join('/') }));

export const childPath = (dir: string, name: string): string =>
  dir === '' ? name : `${dir}/${name}`;
