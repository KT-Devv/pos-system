"use client";

import {
  Button,
  buildReceipt,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  formatCurrency,
  type PaymentMethod,
  type Receipt,
} from "@pos/shared";
import { Printer } from "lucide-react";
import { useRef } from "react";
import { PrintArea, printPage } from "@/components/print-area";
import type { Shop } from "@/lib/workspace";
import { type Client, paymentLabel } from "./common";

/** Everything the printed receipt needs from the shop, in the shape `buildReceipt` takes. */
export function receiptShop(shop: Shop) {
  return { name: shop.name, address: shop.address, phone: shop.phone, email: shop.email };
}

type SaleRow = {
  id: string;
  created_at: string;
  discount: number;
  payment_method: PaymentMethod;
  cashier_id: string;
  customer_id: string | null;
};

/**
 * Rebuilds a receipt from what the database stored, so a reprint (or the receipt shown right after
 * checkout) shows what was actually charged. Products are looked up separately rather than joined:
 * sale lines and products are linked by a composite key, and two plain queries stay unambiguous.
 * `cashReceived` is not stored anywhere; only the till knows it, at the moment of the sale.
 */
export async function loadSaleReceipt(
  supabase: Client,
  saleId: string,
  shop: Shop,
  options: { cashReceived?: number | null } = {},
): Promise<Receipt> {
  const { data: sale, error: saleError } = await supabase
    .from("sales")
    .select("id,created_at,discount,payment_method,cashier_id,customer_id")
    .eq("id", saleId)
    .single();
  if (saleError) throw saleError;
  const row = sale as unknown as SaleRow;

  const { data: lineRows, error: linesError } = await supabase
    .from("sale_lines")
    .select("product_id,quantity,unit_price")
    .eq("sale_id", saleId);
  if (linesError) throw linesError;
  const saleLines = (lineRows ?? []) as unknown as { product_id: string; quantity: number; unit_price: number }[];

  const productIds = [...new Set(saleLines.map((line) => line.product_id))];
  const [products, cashier, customer] = await Promise.all([
    productIds.length ? supabase.from("products").select("id,name").in("id", productIds) : Promise.resolve({ data: [], error: null }),
    supabase.from("profiles").select("name").eq("id", row.cashier_id).maybeSingle(),
    row.customer_id ? supabase.from("customers").select("name").eq("id", row.customer_id).maybeSingle() : Promise.resolve({ data: null, error: null }),
  ]);
  const names = new Map(((products.data ?? []) as { id: string; name: string }[]).map((product) => [product.id, product.name]));

  return buildReceipt({
    id: row.id,
    issuedAt: row.created_at,
    shop: receiptShop(shop),
    cashier: (cashier.data as { name: string } | null)?.name,
    customer: (customer.data as { name: string } | null)?.name,
    lines: saleLines
      .map((line) => ({ name: names.get(line.product_id) ?? "Item", quantity: line.quantity, unitPrice: line.unit_price }))
      .sort((a, b) => a.name.localeCompare(b.name)),
    discount: row.discount,
    paymentMethod: row.payment_method,
    cashReceived: options.cashReceived,
  });
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className={bold ? "flex items-baseline justify-between gap-3 text-[15px] font-extrabold" : "flex justify-between gap-3"}>
      <span>{label}</span>
      <span className="tabular-nums">{value}</span>
    </div>
  );
}

const rule = "my-2.5 border-t border-dashed border-black/60";

/**
 * The paper itself: 72 mm wide, black on white in both themes (it represents a printed receipt, so
 * it deliberately ignores the app's dark mode). The same element is previewed and printed.
 */
export function ReceiptPaper({ receipt }: { receipt: Receipt }) {
  const { shop } = receipt;
  const when = new Date(receipt.issuedAt);
  return (
    <article aria-label={`Receipt ${receipt.reference}`} className="w-[72mm] max-w-full bg-white px-4 py-5 text-[12px] leading-snug text-black">
      <header className="text-center">
        <h2 className="text-[17px] font-extrabold leading-tight">{shop.name}</h2>
        {shop.address && <p className="mt-1 whitespace-pre-line">{shop.address}</p>}
        {shop.phone && <p>{shop.phone}</p>}
        {shop.email && <p>{shop.email}</p>}
      </header>

      <div className={rule} />
      <div className="grid gap-0.5">
        <Row label="Receipt" value={`#${receipt.reference}`} />
        <Row label="Date" value={when.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })} />
        {receipt.cashier && <Row label="Served by" value={receipt.cashier} />}
        {receipt.customer && <Row label="Customer" value={receipt.customer} />}
      </div>
      {receipt.pending && (
        <p className="mt-2 border border-black px-2 py-1 text-center font-bold">
          OFFLINE SALE: not yet recorded on the server. The receipt number will change once it syncs.
        </p>
      )}

      <div className={rule} />
      <ul className="grid gap-1.5">
        {receipt.lines.map((line, index) => (
          <li key={index}>
            <p className="font-semibold">{line.name}</p>
            <div className="flex justify-between gap-3">
              <span className="tabular-nums">{line.quantity} × {formatCurrency(line.unitPrice)}</span>
              <span className="tabular-nums">{formatCurrency(line.lineTotal)}</span>
            </div>
          </li>
        ))}
      </ul>

      <div className={rule} />
      <div className="grid gap-0.5">
        <Row label={`Subtotal (${receipt.itemCount} ${receipt.itemCount === 1 ? "item" : "items"})`} value={formatCurrency(receipt.subtotal)} />
        {receipt.discount > 0 && <Row label="Discount" value={`−${formatCurrency(receipt.discount)}`} />}
        <div className="pt-1">
          <Row label="TOTAL" value={formatCurrency(receipt.total)} bold />
        </div>
        <div className="pt-1">
          <Row label="Paid by" value={paymentLabel(receipt.paymentMethod)} />
          {receipt.cashReceived !== null && <Row label="Cash received" value={formatCurrency(receipt.cashReceived)} />}
          {receipt.change !== null && <Row label="Change" value={formatCurrency(receipt.change)} />}
        </div>
      </div>

      <div className={rule} />
      <footer className="text-center">
        <p className="font-semibold">Thank you for shopping at {shop.name}!</p>
        <p className="mt-0.5 text-[11px]">Keep this receipt for returns and exchanges.</p>
      </footer>
    </article>
  );
}

/** Shows a receipt with a Print button. Pass `null` to keep it closed. */
export function ReceiptDialog({
  receipt,
  heading = "Receipt",
  onClose,
}: {
  receipt: Receipt | null;
  heading?: string;
  onClose: () => void;
}) {
  const done = useRef<HTMLButtonElement>(null);
  return (
    <>
      <Dialog open={receipt !== null} onOpenChange={(open) => { if (!open) onClose(); }}>
        {/* Focus lands on Done, so a busy cashier can dismiss the receipt with Enter. */}
        <DialogContent className="max-w-md" onOpenAutoFocus={(event) => { event.preventDefault(); done.current?.focus(); }}>
          <DialogHeader>
            <DialogTitle>{heading}</DialogTitle>
            <DialogDescription>
              {receipt && (
                <>
                  {formatCurrency(receipt.total)} · {paymentLabel(receipt.paymentMethod)}
                  {receipt.change !== null && receipt.change > 0 && (
                    <> · <span className="font-semibold text-foreground">give {formatCurrency(receipt.change)} change</span></>
                  )}
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          {receipt && (
            <div className="max-h-[52vh] overflow-y-auto rounded-xl border bg-muted p-3">
              <div className="mx-auto w-fit shadow-sm">
                <ReceiptPaper receipt={receipt} />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button ref={done} type="button" variant="outline" onClick={onClose}>Done</Button>
            <Button type="button" onClick={printPage}>
              <Printer />
              Print receipt
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {receipt && (
        <PrintArea>
          <ReceiptPaper receipt={receipt} />
        </PrintArea>
      )}
    </>
  );
}
