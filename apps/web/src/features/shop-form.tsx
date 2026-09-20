"use client";

import {
  COUNTRIES,
  CURRENCIES,
  currencyDecimals,
  currencyForCountry,
  currencySymbol,
  formatCurrency,
  Input,
  loyaltyPointsFor,
  type ShopInput,
  Switch,
} from "@pos/shared";
import { Lock } from "lucide-react";
import { Field, MenuSelect } from "./common";

/** Form state for a shop: everything is a string or boolean so inputs stay controlled while typing. */
export type ShopFormValues = {
  name: string;
  country: string;
  currency: string;
  phone: string;
  email: string;
  address: string;
  lowStock: string;
  loyaltyEnabled: boolean;
  loyaltySpend: string;
};

export function toShopInput(values: ShopFormValues): ShopInput {
  return {
    name: values.name,
    currency: values.currency,
    country: values.country || null,
    phone: values.phone.trim() || null,
    email: values.email.trim() || null,
    address: values.address.trim() || null,
    lowStockThreshold: values.lowStock.trim() === "" ? Number.NaN : Number(values.lowStock),
    loyaltyEnabled: values.loyaltyEnabled,
    loyaltySpendPerPoint: Number(values.loyaltySpend),
  };
}

export function emptyShopForm(defaults: Partial<ShopFormValues> = {}): ShopFormValues {
  return {
    name: "",
    country: "",
    currency: "USD",
    phone: "",
    email: "",
    address: "",
    lowStock: "5",
    loyaltyEnabled: true,
    loyaltySpend: "10",
    ...defaults,
  };
}

/** Guess the country from the browser's language ("en-GH" -> "GH") to save a step. */
export function guessCountry(): string {
  if (typeof navigator === "undefined") return "";
  for (const language of navigator.languages ?? [navigator.language]) {
    const region = /[-_]([A-Za-z]{2})$/.exec(language)?.[1]?.toUpperCase();
    if (region && COUNTRIES.some((country) => country.code === region)) return region;
  }
  return "";
}

const countryOptions = [
  { value: "", label: "Other / not listed" },
  ...COUNTRIES.map((country) => ({ value: country.code, label: country.name })),
];
const currencyOptions = CURRENCIES.map((currency) => ({ value: currency.code, label: `${currency.code} · ${currency.name}` }));

type Props = {
  values: ShopFormValues;
  onChange: (values: ShopFormValues) => void;
  /** Which part of the form to show; the onboarding wizard splits it across two steps. */
  part: "basics" | "preferences";
  /** Sales already exist, so the currency can no longer change. */
  currencyLocked?: boolean;
  idPrefix?: string;
};

export function ShopForm({ values, onChange, part, currencyLocked = false, idPrefix = "shop" }: Props) {
  const set = <K extends keyof ShopFormValues>(key: K, value: ShopFormValues[K]) => onChange({ ...values, [key]: value });
  const id = (name: string) => `${idPrefix}-${name}`;

  if (part === "basics") {
    return (
      <div className="grid items-start gap-4 sm:grid-cols-2">
        <Field label="Shop name" htmlFor={id("name")} className="sm:col-span-2">
          <Input
            id={id("name")}
            required
            autoComplete="organization"
            placeholder="e.g. Mama Ama Provisions"
            className="h-11"
            value={values.name}
            onChange={(event) => set("name", event.target.value)}
          />
        </Field>

        <Field label="Country">
          <MenuSelect
            className="h-11"
            value={values.country}
            placeholder="Select a country"
            options={countryOptions}
            onValueChange={(country) => {
              const suggested = currencyForCountry(country);
              onChange({ ...values, country, currency: currencyLocked || !suggested ? values.currency : suggested });
            }}
          />
        </Field>

        <Field
          label="Currency"
          hint={
            currencyLocked ? (
              <span className="inline-flex items-center gap-1"><Lock className="h-3 w-3" />Locked because sales have been recorded.</span>
            ) : (
              "This can't be changed after your first sale."
            )
          }
        >
          {currencyLocked ? (
            <Input className="h-11" disabled value={`${values.currency} · ${currencyOptions.find((c) => c.value === values.currency)?.label.split(" · ")[1] ?? ""}`} />
          ) : (
            <MenuSelect className="h-11" value={values.currency} options={currencyOptions} onValueChange={(currency) => set("currency", currency)} />
          )}
        </Field>

        <Field label="Phone (optional)" htmlFor={id("phone")}>
          <Input id={id("phone")} type="tel" autoComplete="tel" className="h-11" value={values.phone} onChange={(event) => set("phone", event.target.value)} />
        </Field>

        <Field label="Shop email (optional)" htmlFor={id("email")}>
          <Input id={id("email")} type="email" className="h-11" value={values.email} onChange={(event) => set("email", event.target.value)} />
        </Field>

        <Field label="Address (optional)" htmlFor={id("address")} className="sm:col-span-2">
          <Input id={id("address")} autoComplete="street-address" className="h-11" value={values.address} onChange={(event) => set("address", event.target.value)} />
        </Field>
      </div>
    );
  }

  const symbol = currencySymbol(values.currency);
  const example = 25;
  const points = loyaltyPointsFor(example, { loyaltyEnabled: values.loyaltyEnabled, loyaltySpendPerPoint: Number(values.loyaltySpend) });

  return (
    <div className="grid gap-6">
      <Field
        label="Low-stock warning"
        htmlFor={id("low-stock")}
        hint="Products with fewer units than this are flagged as low. Set 0 to turn warnings off."
      >
        <Input
          id={id("low-stock")}
          type="number"
          inputMode="numeric"
          min="0"
          step="1"
          className="h-11 w-32 tabular-nums"
          value={values.lowStock}
          onChange={(event) => set("lowStock", event.target.value)}
        />
      </Field>

      <div className="grid gap-4 rounded-xl border p-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-semibold">Loyalty points</p>
            <p className="mt-0.5 text-sm text-muted-foreground">Reward repeat customers with points on every sale.</p>
          </div>
          <Switch
            aria-label="Enable loyalty points"
            checked={values.loyaltyEnabled}
            onCheckedChange={(checked) => set("loyaltyEnabled", checked)}
          />
        </div>

        {values.loyaltyEnabled && (
          <Field label="Spend needed for one point" htmlFor={id("loyalty")}>
            <div className="relative w-44">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-muted-foreground">{symbol}</span>
              <Input
                id={id("loyalty")}
                type="number"
                inputMode="decimal"
                min="0.01"
                step={currencyDecimals(values.currency) === 0 ? "1" : "0.01"}
                className="h-11 tabular-nums"
                style={{ paddingLeft: `${1.1 + symbol.length * 0.6}rem` }}
                value={values.loyaltySpend}
                onChange={(event) => set("loyaltySpend", event.target.value)}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Example: a {formatCurrency(example, values.currency)} sale earns <span className="font-semibold text-foreground">{points}</span> {points === 1 ? "point" : "points"}.
            </p>
          </Field>
        )}
      </div>
    </div>
  );
}
