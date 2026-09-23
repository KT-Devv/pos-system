"use client";

import { Button, formatCurrency, Input, barcodesMatch, validatePackSize } from "@pos/shared";
import { Plus, Trash2 } from "lucide-react";
import { type Client, MoneyInput, type PackSizeRow } from "./common";

/** A pack size as it is being edited: everything is text until it is saved. */
export type PackDraft = { key: string; id?: string; name: string; quantity: string; price: string; barcode: string };

export const newDraft = (): PackDraft => ({ key: crypto.randomUUID(), name: "", quantity: "", price: "", barcode: "" });

export const draftsFrom = (rows: readonly PackSizeRow[]): PackDraft[] =>
  rows.map(row => ({
    key: row.id,
    id: row.id,
    name: row.name,
    quantity: String(row.quantity),
    price: String(row.selling_price),
    barcode: row.barcode ?? "",
  }));

/** Names commonly used for a bigger unit; offered as suggestions, any name works. */
const NAME_SUGGESTIONS = ["Pack", "Box", "Carton", "Strip", "Sachet", "Dozen", "Crate", "Bag", "Bundle", "Pair"];

/**
 * Problems with the pack sizes on the form, worded for the person filling it in. `takenBarcodes` are the
 * codes other products and their pack sizes already use, plus this product's own barcode.
 */
export function draftErrors(drafts: readonly PackDraft[], takenBarcodes: readonly { code: string; owner: string }[]): string[] {
  const errors: string[] = [];
  drafts.forEach((draft, index) => {
    const others = drafts.filter((_, i) => i !== index).map(other => ({ name: other.name, quantity: Number(other.quantity) }));
    errors.push(...validatePackSize({ name: draft.name, quantity: Number(draft.quantity), sellingPrice: Number(draft.price) }, others));
    const code = draft.barcode.trim();
    if (code) {
      const clash = takenBarcodes.find(taken => barcodesMatch(code, taken.code));
      if (clash) errors.push(`${draft.name.trim() || "A pack size"}'s barcode is already used by ${clash.owner}`);
      const repeat = drafts.some((other, i) => i < index && other.barcode.trim() && barcodesMatch(code, other.barcode.trim()));
      if (repeat) errors.push(`Two pack sizes use the barcode ${code}`);
    }
  });
  // The same message can come from several rows; show each once.
  return [...new Set(errors)];
}

/**
 * Makes the stored pack sizes match the form: removes the ones taken off, updates the ones that changed,
 * adds the new ones. Returns the first error, if any.
 */
export async function savePackSizes(
  supabase: Client,
  shopId: string,
  productId: string,
  existing: readonly PackSizeRow[],
  drafts: readonly PackDraft[],
): Promise<{ message: string } | null> {
  const kept = new Set(drafts.flatMap(draft => (draft.id ? [draft.id] : [])));
  const removed = existing.filter(row => !kept.has(row.id));
  if (removed.length > 0) {
    const { error } = await supabase.from("product_units").delete().in("id", removed.map(row => row.id));
    if (error) return error;
  }
  for (const draft of drafts) {
    if (!draft.id) continue;
    const before = existing.find(row => row.id === draft.id);
    const next = { name: draft.name.trim(), quantity: Number(draft.quantity), selling_price: Number(draft.price), barcode: draft.barcode.trim() || null };
    if (before && before.name === next.name && before.quantity === next.quantity && before.selling_price === next.selling_price && (before.barcode ?? null) === next.barcode) continue;
    const { error } = await supabase.from("product_units").update(next).eq("id", draft.id);
    if (error) return error;
  }
  const added = drafts.filter(draft => !draft.id).map(draft => ({
    shop_id: shopId,
    product_id: productId,
    name: draft.name.trim(),
    quantity: Number(draft.quantity),
    selling_price: Number(draft.price),
    barcode: draft.barcode.trim() || null,
  }));
  if (added.length > 0) {
    const { error } = await supabase.from("product_units").insert(added);
    if (error) return error;
  }
  return null;
}

/** The pack sizes section of the product form. */
export function PackSizesEditor({
  drafts,
  onChange,
  singlePrice,
}: {
  drafts: PackDraft[];
  onChange: (next: PackDraft[]) => void;
  /** The single item's price, to show what each item costs inside a pack. */
  singlePrice: number;
}) {
  const update = (key: string, patch: Partial<PackDraft>) => onChange(drafts.map(draft => (draft.key === key ? { ...draft, ...patch } : draft)));

  return (
    <div className="grid gap-3 rounded-xl border bg-muted/40 p-4 sm:col-span-2">
      <div>
        <p className="text-sm font-semibold">Pack sizes</p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Sell this product in packs, boxes or strips at their own price. The price above is for one item, and
          stock is counted in single items: selling a pack of 12 takes 12 items out of stock.
        </p>
      </div>

      {drafts.length > 0 && (
        <div className="grid gap-3">
          <div className="hidden grid-cols-[1fr_5.5rem_7.5rem_1fr_2rem] gap-2 px-0.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground sm:grid">
            <span>Name</span><span>Items in it</span><span>Price</span><span>Barcode (optional)</span><span />
          </div>
          {drafts.map((draft, index) => {
            const quantity = Number(draft.quantity);
            const price = Number(draft.price);
            const each = quantity >= 2 && price > 0 ? price / quantity : null;
            return (
              <div key={draft.key} className="grid gap-1.5">
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-[1fr_5.5rem_7.5rem_1fr_2rem]">
                  <Input
                    aria-label={`Pack size ${index + 1} name`}
                    placeholder="Pack, Box, Strip…"
                    list="pack-name-options"
                    value={draft.name}
                    onChange={event => update(draft.key, { name: event.target.value })}
                  />
                  <Input
                    aria-label={`Pack size ${index + 1}: items in it`}
                    type="number"
                    inputMode="numeric"
                    min="2"
                    step="1"
                    placeholder="Items"
                    className="tabular-nums"
                    value={draft.quantity}
                    onChange={event => update(draft.key, { quantity: event.target.value })}
                  />
                  <MoneyInput aria-label={`Pack size ${index + 1} price`} min="0.01" value={draft.price} onChange={value => update(draft.key, { price: value })} />
                  <Input
                    aria-label={`Pack size ${index + 1} barcode`}
                    placeholder="Barcode"
                    className="font-mono"
                    value={draft.barcode}
                    onChange={event => update(draft.key, { barcode: event.target.value })}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    className="justify-self-end text-muted-foreground hover:text-destructive sm:self-center"
                    aria-label={`Remove pack size ${index + 1}`}
                    onClick={() => onChange(drafts.filter(other => other.key !== draft.key))}
                  >
                    <Trash2 />
                  </Button>
                </div>
                {each !== null && (
                  <p className="px-0.5 text-xs text-muted-foreground">
                    {formatCurrency(each)} per item
                    {singlePrice > 0 && (
                      each < singlePrice
                        ? ` (${formatCurrency(singlePrice - each)} less than buying singles)`
                        : each > singlePrice
                          ? " (more than buying singles)"
                          : " (the same as singles)"
                    )}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}

      <datalist id="pack-name-options">
        {NAME_SUGGESTIONS.map(name => <option key={name} value={name} />)}
      </datalist>

      <div>
        <Button type="button" variant="outline" size="sm" onClick={() => onChange([...drafts, newDraft()])}>
          <Plus />
          Add pack size
        </Button>
      </div>
    </div>
  );
}
