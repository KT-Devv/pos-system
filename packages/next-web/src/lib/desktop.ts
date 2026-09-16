import type { CreateSaleInput } from "@pos/shared";

export async function queueDesktopSale(input: CreateSaleInput & { id: string }) {
  if (typeof window === "undefined" || !("__TAURI_INTERNALS__" in window)) {
    return { queued: false, id: input.id };
  }

  const { invoke } = await import("@tauri-apps/api/core");
  return invoke<{ queued: boolean; id: string }>("queue_sale", {
    sale: {
      id: input.id,
      cashier_id: input.cashierId,
      payment_method: input.paymentMethod,
      discount: Math.round((input.discount ?? 0) * 100),
      lines: input.lines.map((line) => ({
        product_id: line.productId,
        quantity: line.quantity,
      })),
    },
  });
}
