"use client";

import { useState } from "react";
import {
  Alert,
  AlertDescription,
  Button,
  currencyForCountry,
  formatInviteCode,
  Input,
  Label,
  looksLikeInviteCode,
  validateShopInput,
} from "@pos/shared";
import { AlertCircle, ArrowLeft, ArrowRight, Check, KeyRound } from "lucide-react";
import { AuthShell } from "@/components/auth-shell";
import { redeemInviteCode } from "@/lib/invite";
import type { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { emptyShopForm, guessCountry, ShopForm, type ShopFormValues, toShopInput } from "./shop-form";

type Client = ReturnType<typeof createSupabaseBrowserClient>;

type Step = "join" | "basics" | "preferences";

/**
 * First-login setup. Someone with no shop either sets up their own (name, country, currency and a few preferences) or,
 * if they were invited, joins one by typing the invitation code they were given. A code typed at sign-up is tried
 * before this screen is reached; if it did not work, `joinError` says why and the code is filled in to correct.
 */
export function Onboarding({
  supabase,
  user,
  joinError,
  code,
  onDone,
  onSignOut,
}: {
  supabase: Client;
  user: { name: string; email: string | null };
  joinError?: string;
  code?: string;
  onDone: () => Promise<void>;
  onSignOut: () => void;
}) {
  const [step, setStep] = useState<Step>(joinError || code ? "join" : "basics");
  const [inviteCode, setInviteCode] = useState(code ? formatInviteCode(code) : "");
  const [values, setValues] = useState<ShopFormValues>(() => {
    const country = guessCountry();
    return emptyShopForm({ country, currency: currencyForCountry(country) ?? "USD" });
  });
  const [error, setError] = useState<string | null>(joinError ?? null);
  const [busy, setBusy] = useState(false);

  const firstName = user.name.trim().split(" ")[0] || "there";

  const join = async () => {
    if (!looksLikeInviteCode(inviteCode)) {
      setError("An invitation code is 10 letters and numbers, like 7KQ4M-X9HTP.");
      return;
    }
    setBusy(true);
    setError(null);
    const result = await redeemInviteCode(supabase, inviteCode);
    if (!result.ok) {
      setError(result.message);
      setBusy(false);
      return;
    }
    await onDone();
  };

  const next = () => {
    const problems = validateShopInput(toShopInput(values)).filter((message) => /name|currency|email/i.test(message));
    if (problems.length > 0) {
      setError(problems.join(". "));
      return;
    }
    setError(null);
    setStep("preferences");
  };

  const create = async () => {
    const input = toShopInput(values);
    const problems = validateShopInput(input);
    if (problems.length > 0) {
      setError(problems.join(". "));
      return;
    }
    setBusy(true);
    setError(null);
    const { error: createError } = await supabase.rpc("create_shop", {
      p_name: values.name.trim(),
      p_currency: input.currency,
      p_country: input.country,
      p_phone: input.phone,
      p_email: input.email,
      p_address: input.address,
      p_low_stock_threshold: input.lowStockThreshold,
      p_loyalty_enabled: input.loyaltyEnabled,
      p_loyalty_spend_per_point: input.loyaltyEnabled ? input.loyaltySpendPerPoint : 10,
    });
    if (createError) {
      setError(createError.message);
      setBusy(false);
      return;
    }
    await onDone();
  };

  const stepNumber = step === "preferences" ? 2 : 1;

  return (
    <AuthShell wide>
      {step !== "join" && (
        <div className="mb-6 flex items-center gap-3" aria-label={`Step ${stepNumber} of 2`}>
          {[1, 2].map((n) => (
            <span key={n} className={`h-1.5 w-12 rounded-full ${n <= stepNumber ? "bg-primary" : "bg-border"}`} />
          ))}
          <span className="text-xs font-semibold text-muted-foreground">Step {stepNumber} of 2</span>
        </div>
      )}

      {step === "join" && (
        <>
          <div className="mb-6">
            <h1 className="text-[28px] font-extrabold leading-tight tracking-tight">Join a shop, {firstName}</h1>
            <p className="mt-1.5 text-sm text-muted-foreground">
              Type the invitation code you were given. It works once, and expires a day after it was made.
            </p>
          </div>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              void join();
            }}
            className="grid gap-4"
          >
            <div className="grid gap-2">
              <Label htmlFor="join-code">Invitation code</Label>
              <Input
                id="join-code"
                autoFocus
                autoComplete="off"
                autoCapitalize="characters"
                spellCheck={false}
                placeholder="XXXXX-XXXXX"
                maxLength={14}
                className="h-12 font-mono text-lg uppercase tracking-widest"
                value={inviteCode}
                onChange={(event) => { setInviteCode(event.target.value.toUpperCase()); setError(null); }}
              />
            </div>
            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            <Button type="submit" size="xl" disabled={busy}>
              <KeyRound />
              {busy ? "Joining…" : "Join this shop"}
            </Button>
          </form>
          <div className="mt-6 border-t pt-5">
            <p className="text-sm text-muted-foreground">No code? You can run your own shop instead.</p>
            <Button variant="outline" className="mt-2" onClick={() => { setError(null); setStep("basics"); }}>
              Set up my own shop
            </Button>
          </div>
        </>
      )}

      {step === "basics" && (
        <>
          <div className="mb-6">
            <h1 className="text-[28px] font-extrabold leading-tight tracking-tight">Let&apos;s set up your shop</h1>
            <p className="mt-1.5 text-sm text-muted-foreground">
              Welcome, {firstName}. Tell us about your business. You can change most of this later in Settings.
            </p>
          </div>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              next();
            }}
            className="grid gap-6"
          >
            <ShopForm part="basics" values={values} onChange={setValues} idPrefix="setup" />
            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            <div className="flex items-center justify-between gap-3">
              <span />
              <Button type="submit" size="lg">
                Continue
                <ArrowRight />
              </Button>
            </div>
          </form>
          <div className="mt-6 rounded-xl border bg-muted/40 p-4">
            <p className="text-sm font-semibold">Were you invited to someone else&apos;s shop?</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Use the invitation code you were given instead of creating a shop: an account can only work in one.
            </p>
            <Button type="button" variant="outline" size="sm" className="mt-3" onClick={() => { setError(null); setStep("join"); }}>
              <KeyRound />
              I have an invitation code
            </Button>
          </div>
        </>
      )}

      {step === "preferences" && (
        <>
          <div className="mb-6">
            <h1 className="text-[28px] font-extrabold leading-tight tracking-tight">A few preferences</h1>
            <p className="mt-1.5 text-sm text-muted-foreground">Sensible defaults are already filled in. Adjust anything you like.</p>
          </div>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              void create();
            }}
            className="grid gap-6"
          >
            <ShopForm part="preferences" values={values} onChange={setValues} idPrefix="setup" />
            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            <div className="flex items-center justify-between gap-3">
              <Button type="button" variant="ghost" disabled={busy} onClick={() => { setError(null); setStep("basics"); }}>
                <ArrowLeft />
                Back
              </Button>
              <Button type="submit" size="lg" disabled={busy}>
                {busy ? "Creating your shop…" : "Create my shop"}
                {!busy && <Check />}
              </Button>
            </div>
          </form>
        </>
      )}

      <p className="mt-8 text-center text-xs text-muted-foreground">
        Signed in as {user.email ?? user.name} ·{" "}
        <button type="button" onClick={onSignOut} className="font-semibold text-primary hover:underline">
          Sign out
        </button>
      </p>
    </AuthShell>
  );
}
