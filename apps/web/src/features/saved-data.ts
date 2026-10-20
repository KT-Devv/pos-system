import { setServerDown } from "@/lib/connection";
import { after, isTauri, queuedSales, SERVER_WAIT_MS, withQueuedSales } from "@/lib/desktop";
import { showSavedCopy } from "@/lib/outbox";
import { readReplica, type Row } from "@/lib/replica";
import type { Category, Customer, PackSizeRow, Product, Supplier } from "./common";

/** A stock movement, as the Inventory history lists it. */
export type SavedMovement = { id: string; created_at: string; type: "in" | "out" | "adjustment"; quantity: number; notes: string | null; product_id: string; supplier_id: string | null };
export type SavedSale = { id: string; total: number; discount?: number; payment_method: string; created_at: string };

/** What the screens show while offline: the desktop app's saved copy, with sales not yet sent already taken off stock. */
export type SavedShop = {
  savedAt: number;
  products: (Product & { categories: { name: string } | null })[];
  categories: Category[];
  packs: Map<string, PackSizeRow[]>;
  suppliers: Supplier[];
  customers: Customer[];
  movements: SavedMovement[];
  sales: SavedSale[];
  /** Sales rung up offline and waiting to be sent. */
  queuedSales: number;
};

const byName = <T extends { name: string }>(rows: T[]) => [...rows].sort((a, b) => a.name.localeCompare(b.name));

/** `takeOffUnsentSales: false` leaves stock as saved, for the till, which takes the unsent sales off itself. */
export async function savedShop(shopId: string, takeOffUnsentSales = true): Promise<SavedShop | null> {
  const replica = readReplica(shopId);
  if (!replica) return null;
  const { tables } = replica;

  const packs = new Map<string, PackSizeRow[]>();
  for (const row of [...(tables.product_units as unknown as PackSizeRow[])].sort((a, b) => Number(a.quantity) - Number(b.quantity) || a.id.localeCompare(b.id))) {
    const list = packs.get(row.product_id) ?? [];
    list.push({ ...row, quantity: Number(row.quantity), selling_price: Number(row.selling_price) });
    packs.set(row.product_id, list);
  }

  const categories = byName(tables.categories as unknown as Category[]);
  const categoryName = new Map(categories.map((category) => [category.id, category.name]));
  const queued = await queuedSales(shopId).catch(() => ({ sales: 0, lines: [] }));
  const products = withQueuedSales(
    byName(tables.products as unknown as Product[]),
    takeOffUnsentSales ? queued.lines : [],
    (productId, unitId) => packs.get(productId)?.find((pack) => pack.id === unitId)?.quantity ?? 1,
    true,
  ).map((product) => ({ ...product, categories: product.category_id ? { name: categoryName.get(product.category_id) ?? "" } : null }));

  const rows = <T>(list: Row[]) => list as unknown as T[];
  return {
    savedAt: replica.savedAt,
    products,
    categories,
    packs,
    suppliers: byName(rows<Supplier>(tables.suppliers)),
    customers: byName(rows<Customer>(tables.customers)),
    movements: rows<SavedMovement>(tables.stock_movements),
    sales: rows<SavedSale>(tables.sales),
    queuedSales: queued.sales,
  };
}

/**
 * Loads a screen's data the offline-aware way (desktop app):
 *  - offline, or with offline edits not yet sent, it shows the saved copy (`show(saved, true)`);
 *  - otherwise it shows the saved copy straight away if the screen has nothing yet, asks the server, and shows the
 *    server's answer; if the server does not answer within a few seconds, or cannot be reached, the saved copy stays.
 * `ask` makes the screen's own requests and returns how they went, plus a function that puts the answer on screen.
 * On the web it simply asks the server.
 */
export async function loadWithSavedCopy(
  shopId: string,
  hasData: { current: boolean },
  show: (saved: SavedShop, stale: boolean) => void,
  ask: () => Promise<{ unreachable: boolean; ok: boolean; apply: () => void }>,
): Promise<void> {
  const showSaved = async (stale: boolean) => {
    const saved = await savedShop(shopId);
    if (!saved) return false;
    show(saved, stale);
    hasData.current = true;
    return true;
  };
  if (showSavedCopy(shopId) && await showSaved(true)) return;
  if (isTauri() && !hasData.current) await showSaved(false);

  const request = ask();
  let answer = isTauri() && hasData.current ? await Promise.race([request, after(SERVER_WAIT_MS)]) : await request;
  if (isTauri() && (!answer || answer.unreachable)) {
    setServerDown(true);
    if (await showSaved(true)) return;
  }
  answer ??= await request;
  answer.apply();
  if (answer.ok) setServerDown(false);
  hasData.current = true;
}
