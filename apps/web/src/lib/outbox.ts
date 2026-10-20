"use client";

import { useSyncExternalStore } from "react";
import { setServerDown, workOffline } from "./connection";
import { isTauri, isTransientSyncError, isUnreachable, SERVER_WAIT_MS } from "./desktop";
import { cacheRead, cacheWrite } from "./offline-cache";
import { patchReplica, type ReplicaTable, type Row } from "./replica";
import type { createSupabaseBrowserClient } from "./supabase/browser";

type Client = ReturnType<typeof createSupabaseBrowserClient>;

/**
 * Changes made on the desktop app while the server cannot be reached (a product added, stock received, a customer saved).
 * Each one is applied to the saved copy at once, so the screens show it, and kept here in order until the server can
 * take it. Sales have their own queue (SQLite); `syncDesktopSales` replays both in the order they were made.
 *
 * The outbox is deliberately NOT part of `offline-cache` (which signing out clears): unsent changes must survive a
 * sign-out, like unsent sales, and go to their shop when someone signs in again.
 */
export type StockArgs = { p_product_id: string; p_type: "in" | "out" | "adjustment"; p_quantity: number; p_supplier_id: string | null; p_notes: string | null };

export type WriteOp =
  | { type: "insert"; table: string; rows: Row[] }
  | { type: "update"; table: string; id: string; values: Record<string, unknown> }
  | { type: "delete"; table: string; ids: string[] }
  | { type: "stock"; args: StockArgs };

export type Queued = { id: string; at: number; label: string; op: WriteOp; /** Sending was started: the server may already have it. */ attempted?: boolean };
export type WriteError = { message: string; code?: string };

const OUTBOX = (shopId: string) => `kt-outbox:${shopId}`;
const FAILED = (shopId: string) => `kt-outbox-failed:${shopId}`;
const CHANGED = "kt:outbox-changed";

function load<T>(key: string): T[] {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T[]) : [];
  } catch {
    return [];
  }
}

function store(key: string, items: unknown[]): void {
  try {
    if (items.length === 0) window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, JSON.stringify(items));
  } catch {
    // Without storage the change is kept for this session only; it still reaches the server if the app stays open.
  }
  window.dispatchEvent(new Event(CHANGED));
}

export const readOutbox = (shopId: string): Queued[] => (isTauri() ? load<Queued>(OUTBOX(shopId)) : []);
export const pendingChanges = (shopId: string) => readOutbox(shopId).length;

/** Changes the server refused when they were finally sent, with why. Kept so nothing disappears without a trace. */
export const readFailed = (shopId: string) => load<Queued & { reason: string }>(FAILED(shopId));

/** How many offline changes are waiting to be sent. */
export function useOutboxCount(shopId: string): number {
  return useSyncExternalStore(
    (onChange) => {
      window.addEventListener(CHANGED, onChange);
      return () => window.removeEventListener(CHANGED, onChange);
    },
    () => pendingChanges(shopId),
    () => 0,
  );
}

/** Screens show the saved copy (with offline edits) while offline, and while edits are still waiting to be sent. */
export const showSavedCopy = (shopId: string) => workOffline() || pendingChanges(shopId) > 0;

/** Runs a change against the server. */
async function execute(supabase: Client, op: WriteOp, signal?: AbortSignal): Promise<WriteError | null> {
  switch (op.type) {
    case "insert": {
      const query = supabase.from(op.table).insert(op.rows);
      return (await (signal ? query.abortSignal(signal) : query)).error;
    }
    case "update": {
      const query = supabase.from(op.table).update(op.values).eq("id", op.id);
      return (await (signal ? query.abortSignal(signal) : query)).error;
    }
    case "delete": {
      const query = supabase.from(op.table).delete().in("id", op.ids);
      return (await (signal ? query.abortSignal(signal) : query)).error;
    }
    case "stock": {
      const query = supabase.rpc("record_stock_movement", op.args);
      return (await (signal ? query.abortSignal(signal) : query)).error;
    }
  }
}

/** Shows an offline change in the saved copy, the way the server will once it has the change. */
function applyLocally(shopId: string, op: WriteOp): void {
  if (op.type === "stock") {
    const { p_product_id: productId, p_type: type, p_quantity: quantity, p_supplier_id: supplierId, p_notes: notes } = op.args;
    let counted = 0;
    patchReplica(shopId, "products", (rows) => rows.map((row) => {
      if (row.id !== productId) return row;
      counted = Number(row.stock);
      const stock = type === "in" ? counted + quantity : type === "out" ? counted - quantity : quantity;
      return { ...row, stock };
    }));
    patchReplica(shopId, "stock_movements", (rows) => [{
      id: crypto.randomUUID(), shop_id: shopId, product_id: productId, type, supplier_id: supplierId, notes,
      quantity: type === "adjustment" ? quantity - counted : quantity,
      created_at: new Date().toISOString(),
    }, ...rows]);
    return;
  }
  if (op.table === "shops" || op.table === "profiles") {
    const saved = cacheRead<{ user: { name: string }; shop: Record<string, unknown> } & Record<string, unknown>>("workspace");
    if (!saved) return;
    const value = op.table === "shops"
      ? { ...saved.value, shop: { ...saved.value.shop, ...(op.type === "update" ? op.values : {}) } }
      : { ...saved.value, user: { ...saved.value.user, ...(op.type === "update" ? op.values : {}) } };
    cacheWrite("workspace", value, saved.savedAt);
    return;
  }
  const table = op.table as ReplicaTable;
  // Defaults the database fills in, so the new row looks as it will once the server has it.
  if (op.type === "insert") patchReplica(shopId, table, (rows) => [...rows, ...op.rows.map((row) => (table === "customers" ? { loyalty_points: 0, ...row } : row))]);
  else if (op.type === "update") patchReplica(shopId, table, (rows) => rows.map((row) => (row.id === op.id ? { ...row, ...op.values } : row)));
  else {
    const gone = new Set(op.ids);
    patchReplica(shopId, table, (rows) => rows.filter((row) => !gone.has(row.id)));
    // The database removes a deleted product's pack sizes with it.
    if (table === "products") patchReplica(shopId, "product_units", (rows) => rows.filter((row) => !gone.has(String(row.product_id))));
  }
}

function queue(shopId: string, op: WriteOp, label: string): void {
  // The saved copy first: storing the change tells the screens to reload, and they must find it there.
  applyLocally(shopId, op);
  store(OUTBOX(shopId), [...load<Queued>(OUTBOX(shopId)), { id: crypto.randomUUID(), at: Date.now(), label, op }]);
}

/**
 * Makes a change. On the web, or whenever the server answers, it goes straight to the server and the caller gets its
 * answer. On the desktop app, when the server cannot be reached (or earlier offline changes are still waiting, which must
 * go first), the change is kept and shown at once: the answer is `{ error: null, queued: true }`.
 *
 * Inserts must carry their own `id` (use `crypto.randomUUID()`) so that a repeat after a lost answer changes nothing,
 * and so later offline changes can refer to the new row.
 */
export async function write(supabase: Client, shopId: string, op: WriteOp, label: string): Promise<{ error: WriteError | null; queued: boolean }> {
  if (!isTauri()) return { error: await execute(supabase, op), queued: false };

  if (op.type === "stock" && op.args.p_type === "out") {
    // The database refuses to take out more than is on hand; so does the saved copy.
    const product = cacheRead<Row[]>(`replica:${shopId}:products`)?.value.find((row) => row.id === op.args.p_product_id);
    if ((workOffline() || pendingChanges(shopId) > 0) && product && Number(product.stock) < op.args.p_quantity) {
      return { error: { message: "Insufficient stock" }, queued: false };
    }
  }

  if (workOffline() || pendingChanges(shopId) > 0) {
    queue(shopId, op, label);
    return { error: null, queued: true };
  }

  const abort = new AbortController();
  const timer = window.setTimeout(() => abort.abort(), 2 * SERVER_WAIT_MS);
  let error: WriteError | null;
  try {
    error = await execute(supabase, op, abort.signal);
  } catch (cause) {
    error = { message: cause instanceof Error ? `${cause.name}: ${cause.message}` : String(cause) };
  } finally {
    window.clearTimeout(timer);
  }
  if (error && (abort.signal.aborted || isUnreachable(error))) {
    setServerDown(true);
    queue(shopId, op, label);
    return { error: null, queued: true };
  }
  return { error, queued: false };
}

/** Whether the server's stock history already holds this movement (made after it was queued, same product, kind and amount). */
async function alreadyRecorded(supabase: Client, item: Queued): Promise<boolean> {
  if (item.op.type !== "stock") return false;
  const { p_product_id: productId, p_type: type, p_quantity: quantity, p_notes: notes } = item.op.args;
  const { data, error } = await supabase
    .from("stock_movements")
    .select("type,quantity,notes")
    .eq("product_id", productId)
    .eq("type", type)
    .gte("created_at", new Date(item.at - 5000).toISOString())
    .limit(50);
  if (error || !data) return false;
  // A recount stores the difference it made, which is not known here: any recount of the product since will do.
  return data.some((row: { quantity: number; notes: string | null }) => (type === "adjustment" || row.quantity === quantity) && (row.notes ?? null) === (notes ?? null));
}

/** A repeat of an insert whose first answer was lost: the row is already there. */
const alreadyThere = (error: WriteError) => error.code === "23505" && /_pkey/.test(error.message);

export type FlushReport = { sent: number; rejected: string[] };

/**
 * Sends the waiting changes made up to `until` (a time in ms), oldest first. Stops, keeping the rest, when the server
 * cannot be reached. A change the server refuses is taken out and reported: later changes that depended on it will be
 * refused too, and are reported the same way. Returns false when it stopped for lack of a connection.
 */
export async function flushOutbox(supabase: Client, shopId: string, report: FlushReport, until = Infinity): Promise<boolean> {
  for (const item of readOutbox(shopId)) {
    if (item.at > until) break;
    let error: WriteError | null;
    try {
      // A stock movement adds to the stock each time it is recorded, so one whose sending may have been cut short (the
      // app was closed mid-send) is checked against the server's history before it is sent again.
      if (item.op.type === "stock") {
        if (item.attempted && await alreadyRecorded(supabase, item)) {
          store(OUTBOX(shopId), load<Queued>(OUTBOX(shopId)).filter((queued) => queued.id !== item.id));
          report.sent += 1;
          continue;
        }
        store(OUTBOX(shopId), load<Queued>(OUTBOX(shopId)).map((queued) => (queued.id === item.id ? { ...queued, attempted: true } : queued)));
      }
      error = await execute(supabase, item.op);
    } catch (cause) {
      error = { message: cause instanceof Error ? `${cause.name}: ${cause.message}` : String(cause) };
    }
    if (error && !alreadyThere(error)) {
      if (isTransientSyncError(error)) return false;
      store(OUTBOX(shopId), load<Queued>(OUTBOX(shopId)).filter((queued) => queued.id !== item.id));
      store(FAILED(shopId), [...load(FAILED(shopId)), { ...item, reason: error.message }].slice(-50));
      report.rejected.push(`${item.label}: ${error.message}`);
      continue;
    }
    store(OUTBOX(shopId), load<Queued>(OUTBOX(shopId)).filter((queued) => queued.id !== item.id));
    report.sent += 1;
  }
  return true;
}
