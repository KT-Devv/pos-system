"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle, validateShopInput } from "@pos/shared";
import { useWorkspace, type Shop } from "@/lib/workspace";
import { type Feedback, fail } from "./common";
import { ShopForm, type ShopFormValues, toShopInput } from "./shop-form";

function formFromShop(shop: Shop): ShopFormValues {
  return {
    name: shop.name,
    country: shop.country ?? "",
    currency: shop.currency,
    phone: shop.phone ?? "",
    email: shop.email ?? "",
    address: shop.address ?? "",
    lowStock: String(shop.low_stock_threshold),
    loyaltyEnabled: shop.loyalty_enabled,
    loyaltySpend: String(shop.loyalty_spend_per_point),
  };
}

export function ShopSettings({ onError, onNotice }: Feedback) {
  const { supabase, shop, refresh } = useWorkspace();
  const [values, setValues] = useState<ShopFormValues>(() => formFromShop(shop));
  const [hasSales, setHasSales] = useState<boolean | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let active = true;
    supabase
      .from("sales")
      .select("id", { count: "exact", head: true })
      .eq("shop_id", shop.id)
      .then(({ count, error }) => {
        if (active && !error) setHasSales((count ?? 0) > 0);
      });
    return () => { active = false; };
  }, [supabase, shop.id]);

  const original = useMemo(() => formFromShop(shop), [shop]);
  const dirty = JSON.stringify(values) !== JSON.stringify(original);

  const save = async (event: FormEvent) => {
    event.preventDefault();
    const input = toShopInput(values);
    const problems = validateShopInput(input);
    if (problems.length > 0) {
      onError(problems.join(". "));
      return;
    }
    setSaving(true);
    const update: Record<string, unknown> = {
      name: values.name.trim(),
      country: input.country,
      phone: input.phone,
      email: input.email,
      address: input.address,
      low_stock_threshold: input.lowStockThreshold,
      loyalty_enabled: input.loyaltyEnabled,
      // Keep the stored rate when the programme is off and the field holds something unusable.
      loyalty_spend_per_point: input.loyaltySpendPerPoint > 0 ? input.loyaltySpendPerPoint : shop.loyalty_spend_per_point,
    };
    if (values.currency !== shop.currency) update.currency = values.currency;

    const { error } = await supabase.from("shops").update(update).eq("id", shop.id);
    if (error) {
      setSaving(false);
      fail(onError, error);
      return;
    }
    await refresh();
    setSaving(false);
    onNotice("Shop settings saved.");
  };

  return (
    <form onSubmit={save} className="grid gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Shop details</CardTitle>
          <CardDescription>Your shop&apos;s name, country and currency.</CardDescription>
        </CardHeader>
        <CardContent>
          <ShopForm part="basics" values={values} onChange={setValues} currencyLocked={hasSales === true} idPrefix="settings" />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Preferences</CardTitle>
          <CardDescription>How stock warnings and loyalty behave.</CardDescription>
        </CardHeader>
        <CardContent>
          <ShopForm part="preferences" values={values} onChange={setValues} currencyLocked={hasSales === true} idPrefix="settings" />
        </CardContent>
      </Card>

      <div className="flex items-center gap-3">
        <Button type="submit" size="lg" disabled={!dirty || saving}>
          {saving ? "Saving…" : "Save changes"}
        </Button>
        {dirty && !saving && (
          <Button type="button" variant="ghost" onClick={() => setValues(original)}>
            Discard
          </Button>
        )}
      </div>
    </form>
  );
}
