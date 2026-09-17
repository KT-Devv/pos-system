import type { CreateSaleInput } from "@pos/shared";

function isTauri() {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

export async function queueDesktopSale(input: CreateSaleInput & { id: string }) {
  if (!isTauri()) {
    return { queued: false, id: input.id };
  }

  const { invoke } = await import("@tauri-apps/api/core");
  return invoke<{ queued: boolean; id: string }>("queue_sale", {
    sale: {
      id: input.id,
      cashier_id: input.cashierId,
      customer_id: input.customerId ?? null,
      payment_method: input.paymentMethod,
      discount: Math.round((input.discount ?? 0) * 100),
      lines: input.lines.map((line) => ({
        product_id: line.productId,
        quantity: line.quantity,
      })),
    },
  });
}

export async function syncDesktopSales(
  createSale: (sale: {
    cashierId: string;
    customerId: string | null;
    paymentMethod: "cash" | "momo" | "card";
    discount: number;
    lines: { productId: string; quantity: number; unitPrice: number; unitCost: number }[];
  }) => Promise<void>,
) {
  if (!isTauri() || !navigator.onLine) return 0;
  const { invoke } = await import("@tauri-apps/api/core");
  const operations = await invoke<{ id: string; payload: string }[]>("pending_operations");
  let synced = 0;
  for (const operation of operations) {
    const payload = JSON.parse(operation.payload) as {
      cashier_id: string;
      customer_id: string | null;
      payment_method: "cash" | "momo" | "card";
      discount: number;
      lines: { product_id: string; quantity: number }[];
    };
    await createSale({
      cashierId: payload.cashier_id,
      customerId: payload.customer_id ?? null,
      paymentMethod: payload.payment_method,
      discount: payload.discount / 100,
      lines: payload.lines.map((line) => ({
        productId: line.product_id,
        quantity: line.quantity,
        unitPrice: 0,
        unitCost: 0,
      })),
    });
    await invoke("remove_operation", { id: operation.id });
    synced += 1;
  }
  return synced;
}
