import { calculateSaleTotal, roundCurrency, type PaymentMethod } from "./index.js";

export interface ReceiptShop {
  name: string;
  address?: string | null;
  phone?: string | null;
  email?: string | null;
}

export interface ReceiptLineInput {
  name: string;
  quantity: number;
  unitPrice: number;
}

export interface BuildReceiptInput {
  /** The sale's id. The receipt shows a short form of it, so customers can quote it for a return. */
  id: string;
  issuedAt: string | Date;
  shop: ReceiptShop;
  cashier?: string | null;
  customer?: string | null;
  lines: readonly ReceiptLineInput[];
  discount?: number;
  paymentMethod: PaymentMethod;
  /** Cash handed over. Only meaningful for cash sales; the database does not keep it. */
  cashReceived?: number | null;
  /** True for a sale rung up offline that has not reached the server yet. */
  pending?: boolean;
}

export interface ReceiptLine extends ReceiptLineInput {
  lineTotal: number;
}

export interface Receipt {
  id: string;
  reference: string;
  issuedAt: string;
  shop: ReceiptShop;
  cashier: string | null;
  customer: string | null;
  lines: ReceiptLine[];
  itemCount: number;
  subtotal: number;
  discount: number;
  total: number;
  paymentMethod: PaymentMethod;
  /** Null unless a cash sale was paid with at least the total. */
  cashReceived: number | null;
  change: number | null;
  pending: boolean;
}

/** The short code printed on a receipt: the first eight characters of the sale id. */
export function receiptReference(id: string): string {
  return id.replace(/-/g, "").slice(0, 8).toUpperCase();
}

const clean = (value: string | null | undefined) => {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
};

export function buildReceipt(input: BuildReceiptInput): Receipt {
  const lines: ReceiptLine[] = input.lines.map((line) => ({
    name: line.name.trim() || "Item",
    quantity: line.quantity,
    unitPrice: line.unitPrice,
    lineTotal: roundCurrency(line.quantity * line.unitPrice),
  }));
  const { subtotal, discount, total } = calculateSaleTotal(
    lines.map((line) => ({ productId: "", quantity: line.quantity, unitPrice: line.unitPrice, unitCost: 0 })),
    input.discount ?? 0,
  );

  const tendered = input.paymentMethod === "cash" ? input.cashReceived ?? null : null;
  const paidInFull = tendered !== null && Number.isFinite(tendered) && tendered >= total;

  return {
    id: input.id,
    reference: receiptReference(input.id),
    issuedAt: typeof input.issuedAt === "string" ? input.issuedAt : input.issuedAt.toISOString(),
    shop: {
      name: input.shop.name.trim(),
      address: clean(input.shop.address),
      phone: clean(input.shop.phone),
      email: clean(input.shop.email),
    },
    cashier: clean(input.cashier),
    customer: clean(input.customer),
    lines,
    itemCount: lines.reduce((sum, line) => sum + line.quantity, 0),
    subtotal,
    discount,
    total,
    paymentMethod: input.paymentMethod,
    cashReceived: paidInFull ? roundCurrency(tendered) : null,
    change: paidInFull ? roundCurrency(tendered - total) : null,
    pending: input.pending ?? false,
  };
}
