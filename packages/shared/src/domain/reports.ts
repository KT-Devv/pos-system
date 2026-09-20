import { roundCurrency } from "./index.js";

/** Row shapes as returned by Supabase for the reporting queries. */
export interface ReportSale {
  id: string;
  total: number;
  discount: number;
  payment_method: string;
  created_at: string;
}

export interface ReportLine {
  sale_id: string;
  product_id?: string;
  quantity: number;
  unit_price: number;
  unit_cost: number;
  products?: { name: string } | null;
}

export type ReportRange = "7" | "30" | "90" | "all";

export interface PaymentTotal {
  method: string;
  value: number;
  count: number;
}

export interface TopProduct {
  name: string;
  revenue: number;
  units: number;
}

export interface SalesSummary {
  sales: ReportSale[];
  revenue: number;
  cogs: number;
  profit: number;
  marginPct: number;
  payments: PaymentTotal[];
  topProducts: TopProduct[];
}

export interface RevenueBucket {
  date: Date;
  value: number;
  count: number;
}

const DAY_MS = 86_400_000;
/** Ranges longer than this are grouped by week so charts stay readable. */
export const WEEKLY_AFTER_DAYS = 92;

export function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

/** Whole calendar days from a to b, immune to daylight-saving shifts (a day may be 23h or 25h). */
function daysBetween(a: Date, b: Date): number {
  return Math.round((startOfDay(b).getTime() - startOfDay(a).getTime()) / DAY_MS);
}

/** First day (local midnight) covered by a report range. "all" starts at the earliest sale. */
export function rangeStart(range: ReportRange, sales: readonly ReportSale[], now = new Date()): Date {
  const today = startOfDay(now);
  if (range === "all") {
    const earliest = sales.reduce((min, sale) => Math.min(min, new Date(sale.created_at).getTime()), now.getTime());
    return startOfDay(new Date(earliest));
  }
  return new Date(today.getFullYear(), today.getMonth(), today.getDate() - (Number(range) - 1));
}

/**
 * Totals for the sales that fall on or after `start`.
 * Revenue is what customers paid (after discounts); cost of goods comes from the lines of exactly
 * those sales, so profit never mixes sales outside the period with lines from inside it.
 */
export function summarizeSales(
  allSales: readonly ReportSale[],
  allLines: readonly ReportLine[],
  start: Date,
  methods: readonly string[] = ["cash", "momo", "card"],
): SalesSummary {
  const sales = allSales.filter((sale) => new Date(sale.created_at) >= start);
  const ids = new Set(sales.map((sale) => sale.id));
  const lines = allLines.filter((line) => ids.has(line.sale_id));

  const revenue = roundCurrency(sales.reduce((sum, sale) => sum + Number(sale.total), 0));
  const cogs = roundCurrency(lines.reduce((sum, line) => sum + Number(line.quantity) * Number(line.unit_cost), 0));
  const profit = roundCurrency(revenue - cogs);
  const marginPct = revenue > 0 ? Math.round((profit / revenue) * 100) : 0;

  const payments = methods.map((method) => {
    const rows = sales.filter((sale) => sale.payment_method === method);
    return {
      method,
      value: roundCurrency(rows.reduce((sum, sale) => sum + Number(sale.total), 0)),
      count: rows.length,
    };
  });

  const byProduct = new Map<string, TopProduct>();
  for (const line of lines) {
    const name = line.products?.name;
    if (!name || !line.product_id) continue;
    const entry = byProduct.get(line.product_id) ?? { name, revenue: 0, units: 0 };
    entry.revenue = roundCurrency(entry.revenue + Number(line.quantity) * Number(line.unit_price));
    entry.units += Number(line.quantity);
    byProduct.set(line.product_id, entry);
  }
  const topProducts = [...byProduct.values()].sort((a, b) => b.revenue - a.revenue).slice(0, 5);

  return { sales, revenue, cogs, profit, marginPct, payments, topProducts };
}

/** Revenue per day from `start` through `now`, or per 7-day block for long ranges. */
export function buildRevenueBuckets(
  sales: readonly ReportSale[],
  start: Date,
  now = new Date(),
): { buckets: RevenueBucket[]; weekly: boolean } {
  const days = Math.max(1, daysBetween(start, now) + 1);
  const weekly = days > WEEKLY_AFTER_DAYS;
  const size = weekly ? 7 : 1;
  const buckets: RevenueBucket[] = Array.from({ length: Math.ceil(days / size) }, (_, i) => ({
    date: new Date(start.getFullYear(), start.getMonth(), start.getDate() + i * size),
    value: 0,
    count: 0,
  }));

  for (const sale of sales) {
    const bucket = buckets[Math.floor(daysBetween(start, new Date(sale.created_at)) / size)];
    if (bucket) {
      bucket.value = roundCurrency(bucket.value + Number(sale.total));
      bucket.count += 1;
    }
  }
  return { buckets, weekly };
}
