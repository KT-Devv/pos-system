"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { Alert, AlertDescription, Button, Label } from "@pos/shared";
import { AlertCircle, CheckCircle2 } from "lucide-react";
import { AuthShell } from "@/components/auth-shell";
import { PasswordInput } from "@/components/password-input";
import { createSupabaseBrowserClient, isSupabaseConfigured } from "@/lib/supabase/browser";
import { describeAuthError, readUrlAuthError } from "@/lib/supabase/auth-errors";

export default function ResetPasswordPage() {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [busy, setBusy] = useState(false);
  // "checking" until we know whether the recovery link produced a session.
  const [link, setLink] = useState<"checking" | "ready" | "invalid">("checking");

  useEffect(() => {
    const linkError = readUrlAuthError(new URL(window.location.href));
    if (linkError) {
      setError(linkError.message);
      setLink("invalid");
      return;
    }
    if (!isSupabaseConfigured()) {
      setLink("ready");
      return;
    }
    let active = true;
    // Creating the client exchanges the recovery code in the URL for a session; getUser waits for that.
    createSupabaseBrowserClient()
      .auth.getUser()
      .then(({ data }) => {
        if (!active) return;
        if (data.user) setLink("ready");
        else {
          setError("This password reset link is invalid or has expired. Request a new one.");
          setLink("invalid");
        }
      });
    return () => {
      active = false;
    };
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (password.length < 6) {
      setError("Password must be at least 6 characters long.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setBusy(true);
    setError(null);
    try {
      if (!isSupabaseConfigured()) {
        throw new Error("Configure Supabase in apps/web/.env.local before continuing.");
      }
      const supabase = createSupabaseBrowserClient();
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) throw updateError;
      setSuccess(true);
    } catch (cause) {
      setError(describeAuthError(cause).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthShell>
      <div className="mb-7">
        <h1 className="text-[28px] font-extrabold leading-tight tracking-tight">
          {success ? "Password updated" : link === "invalid" ? "This link can't be used" : "Choose a new password"}
        </h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          {success
            ? "You're all set. Sign in with your new password."
            : link === "invalid"
            ? "Reset links work once and expire after a while."
            : "Pick something at least 6 characters long."}
        </p>
      </div>

      {link === "invalid" && !success ? (
        <div className="grid gap-4">
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
          <Button asChild size="xl" className="w-full">
            <Link href="/login?tab=forgot">Request a new link</Link>
          </Button>
          <p className="text-center text-sm">
            <Link href="/login" className="font-semibold text-primary hover:underline">
              ← Back to sign in
            </Link>
          </p>
        </div>
      ) : success ? (
        <div className="grid gap-4">
          <Alert variant="success">
            <CheckCircle2 className="h-4 w-4" />
            <AlertDescription>Your password has been updated successfully.</AlertDescription>
          </Alert>
          <Button asChild size="xl" className="w-full">
            <Link href="/login">Continue to sign in</Link>
          </Button>
        </div>
      ) : (
        <form onSubmit={submit} className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="new-password">New password</Label>
            <PasswordInput
              id="new-password"
              required
              autoComplete="new-password"
              className="h-11"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="confirm-password">Confirm new password</Label>
            <PasswordInput
              id="confirm-password"
              required
              autoComplete="new-password"
              className="h-11"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
            />
          </div>

          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <Button disabled={busy || link === "checking"} type="submit" size="xl" className="mt-1">
            {busy ? "Updating password…" : "Update password"}
          </Button>

          <p className="mt-3 text-center text-sm">
            <Link href="/login" className="font-semibold text-primary hover:underline">
              ← Back to sign in
            </Link>
          </p>
        </form>
      )}
    </AuthShell>
  );
}
