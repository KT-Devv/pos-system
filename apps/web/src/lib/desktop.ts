import type { CreateSaleInput } from "@pos/shared";

export function isTauri() {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

/** `shopId` is stored with the sale so it is only ever submitted to the shop it was rung up in. */
export async function queueDesktopSale(input: CreateSaleInput & { id: string; shopId: string }) {
  if (!isTauri()) {
    return { queued: false, id: input.id };
  }

  const { invoke } = await import("@tauri-apps/api/core");
  return invoke<{ queued: boolean; id: string }>("queue_sale", {
    sale: {
      id: input.id,
      shop_id: input.shopId,
      cashier_id: input.cashierId,
      customer_id: input.customerId ?? null,
      payment_method: input.paymentMethod,
      discount: input.discount ?? 0,
      lines: input.lines.map((line) => ({
        product_id: line.productId,
        quantity: line.quantity,
      })),
    },
  });
}

type Invoke = <T>(command: string, args?: Record<string, unknown>) => Promise<T>;

type SyncSale = {
  shopId: string;
  cashierId: string;
  customerId: string | null;
  paymentMethod: "cash" | "momo" | "card";
  discount: number;
  lines: { productId: string; quantity: number; unitPrice: number; unitCost: number }[];
};

/** Maximum attempts before a sale the server keeps rejecting is dropped from the queue. */
const MAX_ATTEMPTS = 3;

/**
 * A failure that says nothing about the sale itself: no connectivity, or the request never got
 * an answer. The server's own rejections (out of stock, unknown product) carry a SQLSTATE code.
 */
export function isTransientSyncError(cause: unknown) {
  if (typeof navigator !== "undefined" && !navigator.onLine) return true;
  const details = (typeof cause === "object" && cause !== null ? cause : {}) as { code?: unknown; message?: unknown };
  const code = typeof details.code === "string" ? details.code : "";
  const message = typeof details.message === "string" ? details.message : String(cause);
  return code === "" && /fetch|network|timeout|timed out|load failed|connection/i.test(message);
}

// Sync runs whenever a screen mounts or the connection returns, so overlapping runs are normal.
// Two runs reading the same queue would each submit the same sale and deduct its stock twice.
let syncInFlight: Promise<number> | null = null;

/**
 * Submits the queued sales that belong to `shopId`. Sales queued for another shop (a different
 * account signed in on this computer) stay untouched until that shop is open again.
 * `invokeImpl` exists so tests can run the sync without a Tauri runtime.
 */
export function syncDesktopSales(shopId: string, createSale: (sale: SyncSale) => Promise<void>, invokeImpl?: Invoke): Promise<number> {
  if (!isTauri() || !navigator.onLine) return Promise.resolve(0);
  if (!syncInFlight) {
    syncInFlight = runSync(shopId, createSale, invokeImpl).finally(() => {
      syncInFlight = null;
    });
  }
  return syncInFlight;
}

async function runSync(shopId: string, createSale: (sale: SyncSale) => Promise<void>, invokeImpl?: Invoke) {
  const invoke: Invoke = invokeImpl ?? (await import("@tauri-apps/api/core")).invoke;
  const operations = await invoke<{ id: string; payload: string; attempts?: number }[]>("pending_operations");
  let synced = 0;
  const dropped: string[] = [];

  for (const operation of operations) {
    try {
      const payload = JSON.parse(operation.payload) as {
        shop_id?: string;
        cashier_id: string;
        customer_id: string | null;
        payment_method: "cash" | "momo" | "card";
        discount: number;
        lines: { product_id: string; quantity: number }[];
      };
      // Sales queued before shops existed have no shop_id; they belong to the shop that was migrated.
      if (payload.shop_id && payload.shop_id !== shopId) continue;
      await createSale({
        shopId,
        cashierId: payload.cashier_id,
        customerId: payload.customer_id ?? null,
        paymentMethod: payload.payment_method,
        discount: payload.discount,
        lines: payload.lines.map((line) => ({
          productId: line.product_id,
          quantity: line.quantity,
          unitPrice: 0,
          unitCost: 0,
        })),
      });
      await invoke("remove_operation", { id: operation.id });
      synced += 1;
    } catch (cause) {
      console.error(`Offline operation ${operation.id} failed to sync:`, cause);
      if (isTransientSyncError(cause)) {
        // Connection trouble: keep the sale queued and untouched, and stop; the rest will fail too.
        break;
      }
      const attempts = (operation.attempts ?? 0) + 1;
      if (attempts >= MAX_ATTEMPTS) {
        await invoke("remove_operation", { id: operation.id });
        dropped.push(cause instanceof Error ? cause.message : String((cause as { message?: unknown })?.message ?? cause));
      } else {
        await invoke("increment_attempts", { id: operation.id });
      }
    }
  }

  // Never lose a sale silently: tell the user what was discarded and why.
  if (dropped.length > 0) {
    throw new Error(
      `${dropped.length} offline ${dropped.length === 1 ? "sale was" : "sales were"} rejected by the server ${MAX_ATTEMPTS} times and removed from the queue: ${dropped[0]}`,
    );
  }
  return synced;
}
