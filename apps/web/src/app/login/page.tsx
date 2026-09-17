"use client";

import { FormEvent, useState } from "react";
import { createSupabaseBrowserClient, isSupabaseConfigured } from "@/lib/supabase/browser";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      if (!isSupabaseConfigured()) {
        throw new Error("Configure Supabase in apps/web/.env.local before signing in.");
      }
      const supabase = createSupabaseBrowserClient();
      const { error: authError } = await supabase.auth.signInWithPassword({ email, password });
      if (authError) throw authError;
      window.location.assign("/");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to sign in");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="grid min-h-screen place-items-center bg-neutral-50 px-6">
      <form onSubmit={submit} className="w-full max-w-md rounded-xl border bg-white p-8 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-neutral-500">POS System</p>
        <h1 className="mt-2 text-2xl font-bold">Sign in</h1>
        <div className="mt-8 space-y-4">
          <label className="block text-sm font-medium">Email<input required type="email" value={email} onChange={(event) => setEmail(event.target.value)} className="mt-2 h-11 w-full rounded-md border px-3" /></label>
          <label className="block text-sm font-medium">Password<input required type="password" value={password} onChange={(event) => setPassword(event.target.value)} className="mt-2 h-11 w-full rounded-md border px-3" /></label>
          {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
          <button disabled={busy} className="h-11 w-full rounded-md bg-neutral-900 font-semibold text-white disabled:opacity-50">{busy ? "Signing in..." : "Sign in"}</button>
        </div>
      </form>
    </main>
  );
}
