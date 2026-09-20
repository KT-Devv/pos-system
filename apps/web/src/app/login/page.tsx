"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Alert, AlertDescription, Button, Input, Label, SegmentedControl } from "@pos/shared";
import { AlertCircle, CheckCircle2, MailCheck } from "lucide-react";
import { AuthShell } from "@/components/auth-shell";
import { PasswordInput } from "@/components/password-input";
import { createSupabaseBrowserClient, isSupabaseConfigured } from "@/lib/supabase/browser";
import { describeAuthError, isDeadSessionError, readUrlAuthError } from "@/lib/supabase/auth-errors";

type AuthMode = "login" | "signup" | "forgot";

const MIN_PASSWORD_LENGTH = 6;

export default function LoginPage() {
  const configured = isSupabaseConfigured();
  const [mode, setMode] = useState<AuthMode>("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [canResend, setCanResend] = useState(false);
  const [busy, setBusy] = useState(false);
  const [checking, setChecking] = useState(configured);

  // Runs once on arrival: honour ?tab=, surface errors from expired email links, and skip the
  // form for anyone who already has a valid session (including one just created by a
  // confirmation link, which the client exchanges for a session while initialising).
  useEffect(() => {
    const url = new URL(window.location.href);
    const tab = url.searchParams.get("tab");
    if (tab === "signup" || tab === "forgot") setMode(tab);

    const linkError = readUrlAuthError(url);
    if (linkError) setError(linkError.message);

    if (!configured) return;
    let active = true;
    const supabase = createSupabaseBrowserClient();
    supabase.auth
      .getUser()
      .then(async ({ data, error: userError }) => {
        if (!active) return;
        if (data.user) {
          window.location.replace("/");
          return;
        }
        if (userError && isDeadSessionError(userError)) {
          // A leftover session the server no longer accepts: drop it so signing in starts clean.
          await supabase.auth.signOut({ scope: "local" });
        } else if (userError && userError.name !== "AuthSessionMissingError" && !linkError) {
          setError(describeAuthError(userError).message);
        }
        setChecking(false);
      });
    return () => {
      active = false;
    };
  }, [configured]);

  const resetFeedback = () => {
    setError(null);
    setNotice(null);
    setCanResend(false);
  };

  const switchMode = (next: AuthMode) => {
    setMode(next);
    resetFeedback();
  };

  const run = useCallback(async (action: () => Promise<void>) => {
    setBusy(true);
    resetFeedback();
    try {
      if (!configured) {
        throw new Error("Configure Supabase in apps/web/.env.local before signing in.");
      }
      await action();
    } catch (cause) {
      const failure = describeAuthError(cause);
      setError(failure.message);
      setCanResend(failure.code === "email_not_confirmed");
    } finally {
      setBusy(false);
    }
  }, [configured]);

  const signIn = (address: string) => run(async () => {
    const { data, error: signInError } = await createSupabaseBrowserClient().auth.signInWithPassword({
      email: address,
      password,
    });
    if (signInError) throw signInError;
    if (!data.session) throw new Error("Sign in didn't return a session. Try again.");
    window.location.assign("/");
  });

  const signUp = (address: string) => run(async () => {
    if (!name.trim()) throw new Error("Display name is required.");
    if (password.length < MIN_PASSWORD_LENGTH) {
      throw new Error(`Password must be at least ${MIN_PASSWORD_LENGTH} characters long.`);
    }
    if (password !== confirmPassword) throw new Error("Passwords do not match.");

    const { data, error: signUpError } = await createSupabaseBrowserClient().auth.signUp({
      email: address,
      password,
      options: {
        data: { display_name: name.trim() },
        emailRedirectTo: `${window.location.origin}/login`,
      },
    });
    if (signUpError) throw signUpError;
    // With email confirmation on, signing up an address that already exists returns no error
    // and a user with no identities, so it has to be detected here.
    if (data.user && data.user.identities?.length === 0) {
      throw Object.assign(new Error("exists"), { code: "user_already_exists" });
    }
    if (data.session) {
      window.location.assign("/");
      return;
    }
    // Set the mode directly: switchMode() would clear the notice we're about to show.
    setMode("login");
    setPassword("");
    setConfirmPassword("");
    setNotice(`Account created. We sent a confirmation link to ${address}. Confirm it, then sign in.`);
    setCanResend(true);
  });

  const sendReset = (address: string) => run(async () => {
    const { error: resetError } = await createSupabaseBrowserClient().auth.resetPasswordForEmail(address, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    if (resetError) throw resetError;
    setNotice("Password reset email sent. Check your inbox for the reset link.");
  });

  const resendConfirmation = () => run(async () => {
    const address = email.trim();
    if (!address) throw new Error("Enter your email address first.");
    const { error: resendError } = await createSupabaseBrowserClient().auth.resend({
      type: "signup",
      email: address,
      options: { emailRedirectTo: `${window.location.origin}/login` },
    });
    if (resendError) throw resendError;
    setNotice(`Confirmation email sent to ${address}.`);
    setCanResend(true);
  });

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const address = email.trim();
    if (!address) {
      setError("Email address is required.");
      return;
    }
    if (mode !== "forgot" && !password) {
      setError("Password is required.");
      return;
    }
    if (mode === "login") void signIn(address);
    else if (mode === "signup") void signUp(address);
    else void sendReset(address);
  }

  const heading = {
    login: { title: "Welcome back", text: "Sign in to open your workspace." },
    signup: { title: "Create your account", text: "Set up access to the KT POS System workspace." },
    forgot: { title: "Reset your password", text: "Enter your email and we'll send you a reset link." },
  }[mode];

  return (
    <AuthShell>
      <div className="mb-7">
        <h1 className="text-[28px] font-extrabold leading-tight tracking-tight">{heading.title}</h1>
        <p className="mt-1.5 text-sm text-muted-foreground">{heading.text}</p>
      </div>

      {mode !== "forgot" && (
        <SegmentedControl
          aria-label="Sign in or create an account"
          size="lg"
          fullWidth
          className="mb-6"
          value={mode}
          onValueChange={switchMode}
          options={[
            { value: "login", label: "Sign in" },
            { value: "signup", label: "Create account" },
          ]}
        />
      )}

      {!configured && (
        <Alert variant="destructive" className="mb-5">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            <p className="font-semibold">Workspace not connected</p>
            Add your Supabase URL and anon key to <code className="font-mono text-xs">apps/web/.env.local</code>.
          </AlertDescription>
        </Alert>
      )}

      <form onSubmit={submit} className="grid gap-4" noValidate>
        {mode === "signup" && (
          <div className="grid gap-2">
            <Label htmlFor="signup-name">Display name</Label>
            <Input id="signup-name" required autoComplete="name" className="h-11" value={name} onChange={(event) => setName(event.target.value)} />
          </div>
        )}

        <div className="grid gap-2">
          <Label htmlFor="auth-email">Email</Label>
          <Input
            id="auth-email"
            required
            type="email"
            autoComplete="email"
            placeholder="name@example.com"
            className="h-11"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </div>

        {mode !== "forgot" && (
          <div className="grid gap-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="auth-password">Password</Label>
              {mode === "login" && (
                <button type="button" onClick={() => switchMode("forgot")} className="text-[13px] font-semibold text-primary hover:underline">
                  Forgot password?
                </button>
              )}
            </div>
            <PasswordInput
              id="auth-password"
              required
              autoComplete={mode === "signup" ? "new-password" : "current-password"}
              className="h-11"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </div>
        )}

        {mode === "signup" && (
          <div className="grid gap-2">
            <Label htmlFor="signup-confirm">Confirm password</Label>
            <PasswordInput
              id="signup-confirm"
              required
              autoComplete="new-password"
              className="h-11"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
            />
          </div>
        )}

        {notice && (
          <Alert variant="success">
            {canResend ? <MailCheck className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}
            <AlertDescription>{notice}</AlertDescription>
          </Alert>
        )}
        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <Button disabled={busy || checking} type="submit" size="xl" className="mt-1">
          {checking
            ? "Checking session…"
            : busy
            ? "Please wait…"
            : mode === "login"
            ? "Sign in"
            : mode === "signup"
            ? "Create account"
            : "Send reset link"}
        </Button>

        {canResend && (
          <Button type="button" variant="outline" size="lg" disabled={busy} onClick={() => void resendConfirmation()}>
            Resend confirmation email
          </Button>
        )}
      </form>

      <p className="mt-7 text-center text-sm text-muted-foreground">
        {mode === "forgot" ? (
          <button type="button" onClick={() => switchMode("login")} className="font-semibold text-primary hover:underline">
            ← Back to sign in
          </button>
        ) : (
          <Link href="/" className="font-medium underline-offset-4 hover:text-foreground hover:underline">
            Back to home
          </Link>
        )}
      </p>
    </AuthShell>
  );
}
