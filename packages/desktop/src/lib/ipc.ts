import type { ElectronAPI } from '../../electron/preload';

function getElectronAPI(): ElectronAPI | null {
  if (typeof window !== 'undefined' && window.electronAPI) {
    return window.electronAPI;
  }
  return null;
}

function assertElectronAPI(): ElectronAPI {
  const electron = getElectronAPI();
  if (!electron) {
    throw new Error('Electron API is not available. Open the app from the desktop client instead of the web preview.');
  }
  return electron;
}

export const api = new Proxy({} as ElectronAPI, {
  get(_target, prop) {
    const electron = assertElectronAPI();
    const value = electron[prop as keyof ElectronAPI];
    if (typeof value === 'object' && value !== null) {
      return new Proxy(value as object, {
        get(_t, method) {
          return (value as Record<string, unknown>)[method as string];
        },
      });
    }
    return value;
  },
});

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}
