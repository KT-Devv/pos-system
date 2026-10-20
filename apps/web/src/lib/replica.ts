import { cacheRead, cacheWrite } from "./offline-cache";
import type { createSupabaseBrowserClient } from "./supabase/browser";

type Client = ReturnType<typeof createSupabaseBrowserClient>;

/**
 * The desktop app's saved copy of the shop's data, one list per table, so every screen can open and work with no
 * internet. It is refreshed from the server whenever the app is online and nothing is waiting to be sent
 * (`refreshReplica`), and changed in place by offline edits (`lib/outbox.ts`) so the screens show them at once.
 */
export type Row = { id: string } & Record<string, unknown>;

export const REPLICA_TABLES = ["products", "categories", "product_units", "customers", "suppliers", "stock_movements", "sales"] as const;
export type ReplicaTable = (typeof REPLICA_TABLES)[number];

/** Tables a screen cannot work without; the rest (history) may be missing from a copy that did not fit in storage. */
const ESSENTIAL: ReplicaTable[] = ["products", "categories", "product_units", "customers", "suppliers"];

/** Longest history kept: enough for the Inventory history and today's figures, small enough to always fit. */
const HISTORY_ROWS = { stock_movements: 3000, sales: 500 } as const;

const keyOf = (shopId: string, table: ReplicaTable) => `replica:${shopId}:${table}`;

export type Replica = { savedAt: number; tables: Record<ReplicaTable, Row[]> };

export function readReplica(shopId: string): Replica | null {
  const tables = {} as Record<ReplicaTable, Row[]>;
  let savedAt = Infinity;
  for (const table of REPLICA_TABLES) {
    const saved = cacheRead<Row[]>(keyOf(shopId, table));
    if (!saved && ESSENTIAL.includes(table)) return null;
    tables[table] = saved?.value ?? [];
    if (saved) savedAt = Math.min(savedAt, saved.savedAt);
  }
  return { savedAt, tables };
}

/** Changes one table of the saved copy (an offline edit), keeping the time the copy was last confirmed by the server. */
export function patchReplica(shopId: string, table: ReplicaTable, change: (rows: Row[]) => Row[]): void {
  const saved = cacheRead<Row[]>(keyOf(shopId, table));
  if (!saved) return;
  cacheWrite(keyOf(shopId, table), change(saved.value), saved.savedAt);
}

async function fetchTable(supabase: Client, table: ReplicaTable): Promise<{ rows: Row[]; ok: boolean }> {
  const rows: Row[] = [];
  const limit = table === "stock_movements" || table === "sales" ? HISTORY_ROWS[table] : Infinity;
  for (let from = 0; rows.length < limit; ) {
    const base = supabase.from(table).select(table === "sales" ? "id,total,discount,payment_method,created_at,customer_id,cashier_id" : "*");
    const ordered = table === "stock_movements" || table === "sales" ? base.order("created_at", { ascending: false }).order("id") : base.order("id");
    const { data, error } = await ordered.range(from, from + 999);
    if (error) return { rows, ok: false };
    if (!data || data.length === 0) break;
    rows.push(...(data as unknown as Row[]));
    from += data.length;
  }
  return { rows: Number.isFinite(limit) ? rows.slice(0, limit) : rows, ok: true };
}

/**
 * Replaces the saved copy with what the server has now. Returns false (and keeps the old copy whole) if any table could
 * not be read, so the copy is never a mixture of old and new.
 */
export async function refreshReplica(supabase: Client, shopId: string, stillCurrent: () => boolean = () => true): Promise<boolean> {
  const fetched = await Promise.all(REPLICA_TABLES.map(async (table) => [table, await fetchTable(supabase, table)] as const));
  if (fetched.some(([, result]) => !result.ok)) return false;
  // An offline edit made while the tables were being read is not in them: keep the copy that has it.
  if (!stillCurrent()) return false;
  const now = Date.now();
  for (const [table, result] of fetched) cacheWrite(keyOf(shopId, table), result.rows, now);
  return true;
}
