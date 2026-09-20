"use client";

import { useState } from "react";
import {
  Alert,
  AlertDescription,
  Button,
  currencyForCountry,
  ROLE_LABELS,
  type ShopRole,
  validateShopInput,
} from "@pos/shared";
import { AlertCircle, ArrowLeft, ArrowRight, Check, Store } from "lucide-react";
import { AuthShell } from "@/components/auth-shell";
import type { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { emptyShopForm, guessCountry, ShopForm, type ShopFormValues, toShopInput } from "./shop-form";

type Client = ReturnType<typeof createSupabaseBrowserClient>;

type Invite = {
  invite_id: string;
  shop_id: string;
  shop_name: string;
  role: ShopRole;
  invited_by_name: string | null;
};

type Step = "invites" | "basics" | "preferences";

/**
 * First-login setup. Someone with no shop either accepts an invitation to an existing one or
 * creates their own, choosing its name, country, currency and a few preferences.
 */
export function Onboarding({
  supabase,
  user,
  invites,
  onDone,
  onSignOut,
}: {
  supabase: Client;
  user: { name: string; email: string | null };
  invites: Invite[];
  onDone: () => Promise<void>;
  onSignOut: () => void;
}) {
  const [step, setStep] = useState<Step>(invites.length > 0 ? "invites" : "basics");
  const [values, setValues] = useState<ShopFormValues>(() => {
    const country = guessCountry();
    return emptyShopForm({ country, currency: currencyForCountry(country) ?? "USD" });
  });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const firstName = user.name.trim().split(" ")[0] || "there";

  const accept = async (invite: Invite) => {
    setBusy(true);
    setError(null);
    const { error: acceptError } = await supabase.rpc("accept_invite", { p_invite_id: invite.invite_id });
    if (acceptError) {
      setError(acceptError.message);
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
      {step !== "invites" && (
        <div className="mb-6 flex items-center gap-3" aria-label={`Step ${stepNumber} of 2`}>
          {[1, 2].map((n) => (
            <span key={n} className={`h-1.5 w-12 rounded-full ${n <= stepNumber ? "bg-primary" : "bg-border"}`} />
          ))}
          <span className="text-xs font-semibold text-muted-foreground">Step {stepNumber} of 2</span>
        </div>
      )}

      {step === "invites" && (
        <>
          <div className="mb-6">
            <h1 className="text-[28px] font-extrabold leading-tight tracking-tight">Welcome, {firstName}</h1>
            <p className="mt-1.5 text-sm text-muted-foreground">
              {invites.length === 1 ? "You've been invited to join a shop." : "You've been invited to join shops."}
            </p>
          </div>
          <ul className="grid gap-3">
            {invites.map((invite) => (
              <li key={invite.invite_id} className="flex items-center gap-4 rounded-xl border bg-card p-4">
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-accent text-accent-foreground">
                  <Store className="h-5 w-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-bold">{invite.shop_name}</p>
                  <p className="text-sm text-muted-foreground">
                    Join as {ROLE_LABELS[invite.role].toLowerCase()}
                    {invite.invited_by_name ? ` · invited by ${invite.invited_by_name}` : ""}
                  </p>
                </div>
                <Button disabled={busy} onClick={() => void accept(invite)}>
                  <Check />
                  Join
                </Button>
              </li>
            ))}
          </ul>
          <div className="mt-6 border-t pt-5">
            <p className="text-sm text-muted-foreground">Want to run your own shop instead?</p>
            <Button variant="outline" className="mt-2" onClick={() => setStep("basics")}>
              Create a new shop
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
              {invites.length > 0 ? (
                <Button type="button" variant="ghost" onClick={() => { setError(null); setStep("invites"); }}>
                  <ArrowLeft />
                  Invitations
                </Button>
              ) : <span />}
              <Button type="submit" size="lg">
                Continue
                <ArrowRight />
              </Button>
            </div>
          </form>
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

      {step === "invites" && error && (
        <Alert variant="destructive" className="mt-4">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
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
