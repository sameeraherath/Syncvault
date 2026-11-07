export type ThemePreference = 'system' | 'light' | 'dark';

const STORAGE_KEY = 'syncvault.theme';

export const loadThemePreference = (): ThemePreference => {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    // Light is the default look; users can opt into System or Dark.
    return v === 'light' || v === 'dark' || v === 'system' ? v : 'light';
  } catch {
    return 'light';
  }
};

export const saveThemePreference = (pref: ThemePreference): void => {
  try {
    localStorage.setItem(STORAGE_KEY, pref);
  } catch {
    // ignore — preference just won't persist
  }
};

export const applyTheme = (pref: ThemePreference): void => {
  const dark =
    pref === 'dark' ||
    (pref === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.classList.toggle('dark', dark);
};
