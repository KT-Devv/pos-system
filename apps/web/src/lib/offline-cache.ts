import { isTauri } from "./desktop";

/**
 * The desktop app keeps a copy of what the till needs (who is signed in, the shop, the catalog) on the computer, so it
 * can open and sell with no internet. The copy is refreshed every time the data loads online and is removed when the
 * person signs out. It is only used by the desktop app: in a browser the page itself cannot load offline.
 */

const PREFIX = "kt-offline:";

export type Cached<T> = { savedAt: number; value: T };

export function cacheWrite(key: string, value: unknown): void {
  if (!isTauri()) return;
  try {
    window.localStorage.setItem(PREFIX + key, JSON.stringify({ savedAt: Date.now(), value }));
  } catch {
    // Storage full or blocked: the till still works online, it just cannot start offline.
  }
}

export function cacheRead<T>(key: string): Cached<T> | null {
  if (!isTauri()) return null;
  try {
    const raw = window.localStorage.getItem(PREFIX + key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Cached<T>;
    return typeof parsed?.savedAt === "number" && "value" in parsed ? parsed : null;
  } catch {
    return null;
  }
}

/** Forget everything saved for offline use (on sign-out, so the next person at this computer sees none of it). */
export function cacheClear(): void {
  if (!isTauri()) return;
  try {
    const keys: string[] = [];
    for (let i = 0; i < window.localStorage.length; i += 1) {
      const key = window.localStorage.key(i);
      if (key?.startsWith(PREFIX)) keys.push(key);
    }
    keys.forEach((key) => window.localStorage.removeItem(key));
  } catch {
    // Nothing to clear.
  }
}
