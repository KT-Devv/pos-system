import type { ElectronAPI } from '../../electron/preload';

function getElectronAPI(): ElectronAPI {
  if (typeof window !== 'undefined' && window.electronAPI) {
    return window.electronAPI;
  }
  throw new Error('Electron API is not available. Run this app in the desktop client.');
}

export const api = new Proxy({} as ElectronAPI, {
  get(_target, prop) {
    const electron = getElectronAPI();
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
