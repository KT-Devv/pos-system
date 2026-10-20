"use client";

import { useSyncExternalStore } from "react";
import { isTauri } from "./desktop";

/**
 * Whether the server can be reached, as far as the desktop app has found out. `navigator.onLine` only says the computer
 * has a network; Wi-Fi without internet still reports "online" while every request hangs or fails. Screens report what
 * their requests found (`setServerDown`), and `useOfflineSync` keeps probing until the server answers again.
 */
let serverDown = false;
const listeners = new Set<() => void>();

export function setServerDown(down: boolean): void {
  if (down === serverDown) return;
  serverDown = down;
  listeners.forEach((listener) => listener());
  if (!down && typeof window !== "undefined") window.dispatchEvent(new Event("kt:server-back"));
}

export const isServerDown = () => serverDown;

/** The desktop app should work from its saved copy: the computer is offline, or the server is not answering. */
export const workOffline = () => isTauri() && (typeof navigator === "undefined" || !navigator.onLine || serverDown);

function subscribe(onChange: () => void) {
  listeners.add(onChange);
  window.addEventListener("online", onChange);
  window.addEventListener("offline", onChange);
  return () => {
    listeners.delete(onChange);
    window.removeEventListener("online", onChange);
    window.removeEventListener("offline", onChange);
  };
}

/** Re-renders when the app starts or stops working from its saved copy. */
export function useWorkOffline(): boolean {
  return useSyncExternalStore(subscribe, workOffline, () => false);
}
