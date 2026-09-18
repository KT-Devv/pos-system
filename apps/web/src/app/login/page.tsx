"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import {
  Alert,
  AlertDescription,
  AlertTitle,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Input,
  Label,
  Tabs,
  TabsList,
  TabsTrigger,
} from "@pos/shared";
import { AlertCircle, CheckCircle2 } from "lucide-react";
import { createSupabaseBrowserClient, isSupabaseConfigured } from "@/lib/supabase/browser";

type AuthMode = "login" | "signup" | "forgot";

export default function LoginPage() {
  const [mode, setMode] = useState<AuthMode>("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const tab = new URLSearchParams(window.location.search).get("tab");
    if (tab === "signup" || tab === "forgot") switchMode(tab);
  }, []);

  const switchMode = (newMode: AuthMode) => {
    setMode(newMode);
    setError(null);
    setNotice(null);
  };

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setNotice(null);

    try {
      if (!isSupabaseConfigured()) {
        throw new Error("Configure Supabase in apps/web/.env.local before signing in.");
      }
      if (!email.trim()) {
        throw new Error("Email address is required.");
      }
      if (mode !== "forgot" && !password) {
        throw new Error("Password is required.");
      }

      const supabase = createSupabaseBrowserClient();

      if (mode === "login") {
        const { error: authError } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        if (authError) throw authError;
        window.location.assign("/");
      } else if (mode === "signup") {
        if (!name.trim()) {
          throw new Error("Display name is required.");
        }
        if (password.length < 6) {
          throw new Error("Password must be at least 6 characters long.");
        }
        if (password !== confirmPassword) {
          throw new Error("Passwords do not match.");
        }
        const { error: signUpError, data } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            data: { display_name: name.trim() },
          },
        });
        if (signUpError) throw signUpError;
        if (data.session) {
          window.location.assign("/");
        } else {
          setNotice("Account created! Check your email to confirm your account or sign in.");
          switchMode("login");
        }
      } else if (mode === "forgot") {
        const redirectUrl = `${window.location.origin}/reset-password`;
        const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim(), {
          redirectTo: redirectUrl,
        });
        if (resetError) throw resetError;
        setNotice("Password reset email sent! Check your inbox for the reset link.");
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Authentication request failed.");
    } finally {
      setBusy(false);
    }
  }

  const configured = isSupabaseConfigured();

  return (
    <main className="grid min-h-screen place-items-center px-6 py-12">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto grid h-10 w-10 place-items-center rounded-lg bg-primary text-sm font-bold text-primary-foreground">
            POS
          </div>
          <CardTitle className="text-2xl">
            {mode === "login" && "Sign in"}
            {mode === "signup" && "Create account"}
            {mode === "forgot" && "Reset password"}
          </CardTitle>
          <CardDescription>
            {mode === "login" && "Access the KTDEVV POS System workspace."}
            {mode === "signup" && "Register a new workspace account."}
            {mode === "forgot" && "We'll email you a reset link."}
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-5">
          <Tabs value={mode} onValueChange={(value) => switchMode(value as AuthMode)}>
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="login">Sign in</TabsTrigger>
              <TabsTrigger value="signup">Sign up</TabsTrigger>
              <TabsTrigger value="forgot">Reset</TabsTrigger>
            </TabsList>
          </Tabs>

          {!configured && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Workspace Not Connected</AlertTitle>
              <AlertDescription>
                Please configure your Supabase URL and anon key in{" "}
                <code>apps/web/.env.local</code> to enable authentication.
              </AlertDescription>
            </Alert>
          )}

          <form onSubmit={submit} className="grid gap-4">
            {mode === "signup" && (
              <div className="grid gap-2">
                <Label htmlFor="signup-name">Display name</Label>
                <Input
                  id="signup-name"
                  required
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                />
              </div>
            )}

            <div className="grid gap-2">
              <Label htmlFor="auth-email">Email</Label>
              <Input
                id="auth-email"
                required
                type="email"
                placeholder="name@example.com"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
            </div>

            {mode !== "forgot" && (
              <div className="grid gap-2">
                <Label htmlFor="auth-password">Password</Label>
                <Input
                  id="auth-password"
                  required
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                />
              </div>
            )}

            {mode === "signup" && (
              <div className="grid gap-2">
                <Label htmlFor="signup-confirm">Confirm Password</Label>
                <Input
                  id="signup-confirm"
                  required
                  type="password"
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                />
              </div>
            )}

            {notice && (
              <Alert variant="success">
                <CheckCircle2 className="h-4 w-4" />
                <AlertDescription>{notice}</AlertDescription>
              </Alert>
            )}
            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <Button disabled={busy} type="submit">
              {busy
                ? "Processing..."
                : mode === "login"
                ? "Sign in"
                : mode === "signup"
                ? "Create account"
                : "Send reset link"}
            </Button>
          </form>

          <div className="text-center">
            {mode === "login" ? (
              <Button variant="link" size="sm" onClick={() => switchMode("forgot")}>
                Forgot password?
              </Button>
            ) : (
              <Button variant="link" size="sm" onClick={() => switchMode("login")}>
                Back to Sign in
              </Button>
            )}
          </div>

          <div className="text-center text-xs text-muted-foreground">
            <Link href="/" className="underline underline-offset-4 hover:text-foreground">
              Back to home
            </Link>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}