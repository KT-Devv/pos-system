import { isTauri } from "./desktop";

/**
 * The public web address of this shop's KT POS System, for links that leave the app: the confirmation and
 * password-reset emails, and the invitation message.
 *
 * In a browser that is simply the address the page was opened at. The desktop app has no public address of its
 * own (its window lives at tauri.localhost, which means nothing in anyone's browser or email), so it uses
 * NEXT_PUBLIC_SITE_URL, which is set when the app is built. Without it, desktop returns null and the
 * caller leaves the link out (Supabase then uses the Site URL set in its Authentication settings).
 */
export function siteUrl(): string | null {
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.trim().replace(/\/+$/, "");
  if (configured) return configured;
  if (typeof window === "undefined" || isTauri()) return null;
  return window.location.origin;
}
