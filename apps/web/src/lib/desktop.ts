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
        unit_id: line.unitId ?? null,
        price_tier: line.priceTier ?? "regular",
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
  lines: { productId: string; quantity: number; unitPrice: number; unitCost: number; unitId: string | null; priceTier: "regular" | "wholesale" }[];
};

/**
 * The server could not be reached at all, so nothing can have been recorded there. Unlike a timeout, which may have
 * happened after the server saved the sale, this is safe to answer by queueing the sale to send later.
 */
export function isUnreachable(cause: unknown) {
  if (typeof navigator !== "undefined" && !navigator.onLine) return true;
  const details = (typeof cause === "object" && cause !== null ? cause : {}) as { code?: unknown; message?: unknown; name?: unknown; status?: unknown };
  if (details.name === "AuthRetryableFetchError" && details.status === 0) return true;
  const code = typeof details.code === "string" ? details.code : "";
  const message = typeof details.message === "string" ? details.message : String(cause);
  return code === "" && /failed to fetch|networkerror|load failed|network request failed|err_internet_disconnected|err_name_not_resolved/i.test(message);
}

/** What a queued sale takes out of stock: the product, how many, and which pack size (if any). */
export type QueuedLine = { productId: string; quantity: number; unitId: string | null };

/** The sales of `shopId` waiting on this computer to be sent, as stock they will use. */
export async function queuedSales(shopId: string, invokeImpl?: Invoke): Promise<{ sales: number; lines: QueuedLine[] }> {
  if (!isTauri()) return { sales: 0, lines: [] };
  const invoke: Invoke = invokeImpl ?? (await import("@tauri-apps/api/core")).invoke;
  const operations = await invoke<{ payload: string }[]>("pending_operations");
  const lines: QueuedLine[] = [];
  let sales = 0;
  for (const operation of operations) {
    try {
      const payload = JSON.parse(operation.payload) as { shop_id?: string; lines: { product_id: string; quantity: number; unit_id?: string | null }[] };
      if (payload.shop_id && payload.shop_id !== shopId) continue;
      sales += 1;
      for (const line of payload.lines) lines.push({ productId: line.product_id, quantity: line.quantity, unitId: line.unit_id ?? null });
    } catch {
      // A queue entry that cannot be read is left for the sync to deal with.
    }
  }
  return { sales, lines };
}

/**
 * `catalog` with the stock that queued sales have already used taken off, so the till never offers what it has sold.
 * Products that run out are dropped, as the server's own list (only products in stock) would. `packSize` says how many
 * single items one unit of a pack size holds.
 */
export function withQueuedSales<T extends { id: string; stock: number }>(catalog: T[], lines: QueuedLine[], packSize: (productId: string, unitId: string) => number): T[] {
  if (lines.length === 0) return catalog;
  const used = new Map<string, number>();
  for (const line of lines) {
    const items = line.quantity * (line.unitId ? packSize(line.productId, line.unitId) : 1);
    used.set(line.productId, (used.get(line.productId) ?? 0) + items);
  }
  return catalog.map((product) => ({ ...product, stock: product.stock - (used.get(product.id) ?? 0) })).filter((product) => product.stock > 0);
}

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
  // The sign-in lapsed while offline: the sale is fine, it just cannot be sent until the person signs in again.
  if (code === "PGRST301" || /jwt|not authenticated|refresh token/i.test(message)) return true;
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
        // "retail" is what sales queued by the version before the second price was called wholesale carry.
        lines: { product_id: string; quantity: number; unit_id?: string | null; price_tier?: "regular" | "wholesale" | "retail" }[];
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
          unitId: line.unit_id ?? null,
          priceTier: line.price_tier === "wholesale" || line.price_tier === "retail" ? "wholesale" : "regular",
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
