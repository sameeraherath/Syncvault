import en from '../renderer/locales/en.json';

/** Strings used by the main process (tray menu, dialogs). Same locale files as the renderer. */
export const mainStrings = {
  trayOpen: en.tray.open,
  trayQuit: en.tray.quit,
  trayTooltip: en.app.name,
} as const;
