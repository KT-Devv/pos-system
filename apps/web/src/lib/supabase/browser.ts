"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

let browserClient: SupabaseClient | null = null;

/**
 * The newest failure the sign-in service answered with (status 500 and up). The auth library reports every such answer as
 * a vague "fetch" error and throws the server's explanation away ("Error sending confirmation email", "Database error saving
 * new user", ...), so it is kept here for describeAuthError to say what really went wrong.
 */
export let lastAuthServerFailure: { status: number; message: string; at: number } | null = null;

const rememberServerFailures: typeof fetch = async (input, init) => {
  const response = await fetch(input, init);
  if (response.status >= 500 && String(input instanceof Request ? input.url : input).includes("/auth/v1/")) {
    try {
      const body = (await response.clone().json()) as Record<string, unknown>;
      const said = [body.msg, body.message, body.error_description, body.error].find((value) => typeof value === "string") as string | undefined;
      lastAuthServerFailure = { status: response.status, message: said ?? "", at: Date.now() };
    } catch {
      lastAuthServerFailure = { status: response.status, message: "", at: Date.now() };
    }
  }
  return response;
};

export function isSupabaseConfigured() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
  return Boolean(
    url &&
    key &&
    !url.includes("your-project") &&
    key.length > 20
  );
}

export function createSupabaseBrowserClient() {
  if (browserClient) return browserClient;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY are required");
  }
  browserClient = createBrowserClient(url, key, { global: { fetch: rememberServerFailures } });
  return browserClient;
}
