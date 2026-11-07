import en from './locales/en.json';

/**
 * Tiny typed i18n helper. All UI text comes from locales/*.json.
 * TODO(i18n): add si.json and ta.json and a language picker; consider i18next if plurals are needed.
 */
type Leaves<T, P extends string = ''> = {
  [K in keyof T & string]: T[K] extends string ? `${P}${K}` : Leaves<T[K], `${P}${K}.`>;
}[keyof T & string];

export type TranslationKey = Leaves<typeof en>;

const lookup = (dict: unknown, key: string): string | undefined => {
  let node: unknown = dict;
  for (const part of key.split('.')) {
    if (typeof node !== 'object' || node === null) return undefined;
    node = (node as Record<string, unknown>)[part];
  }
  return typeof node === 'string' ? node : undefined;
};

export const t = (key: TranslationKey, vars?: Record<string, string | number>): string => {
  const template = lookup(en, key) ?? key;
  return vars
    ? template.replace(/\{\{(\w+)\}\}/g, (_m, name: string) => String(vars[name] ?? ''))
    : template;
};
