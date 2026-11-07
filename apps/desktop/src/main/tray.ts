import { Menu, Tray, nativeImage } from 'electron';
import { mainStrings } from './i18n.js';

export interface TrayActions {
  onOpen: () => void;
  onQuit: () => void;
}

export const createTray = (iconPath: string, actions: TrayActions): Tray => {
  const icon = nativeImage.createFromPath(iconPath).resize({ width: 22, height: 22 });
  const tray = new Tray(icon);
  tray.setToolTip(mainStrings.trayTooltip);
  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: mainStrings.trayOpen, click: actions.onOpen },
      { type: 'separator' },
      { label: mainStrings.trayQuit, click: actions.onQuit },
    ]),
  );
  tray.on('click', actions.onOpen);
  return tray;
};
