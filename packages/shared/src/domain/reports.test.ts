import assert from "node:assert";
import { describe, test } from "node:test";
import {
  buildRevenueBuckets,
  rangeStart,
  summarizeSales,
  WEEKLY_AFTER_DAYS,
  type ReportLine,
  type ReportSale,
} from "./reports.js";

/** Local-time date helper: month is 1-based. */
const at = (y: number, m: number, d: number, h = 12) => new Date(y, m - 1, d, h, 0, 0);

let counter = 0;
const sale = (when: Date, total: number, method = "cash", discount = 0): ReportSale => ({
  id: `s${++counter}`,
  total,
  discount,
  payment_method: method,
  created_at: when.toISOString(),
});
const line = (s: ReportSale, quantity: number, price: number, cost: number, product = "p1", name = "Water"): ReportLine => ({
  sale_id: s.id,
  product_id: product,
  quantity,
  unit_price: price,
  unit_cost: cost,
  products: { name },
});

const NOW = at(2026, 9, 20, 15);

describe("rangeStart", () => {
  test("a 7 day range covers today and the 6 days before it", () => {
    assert.deepStrictEqual(rangeStart("7", [], NOW), at(2026, 9, 14, 0));
  });

  test("a 30 day range crosses a month boundary correctly", () => {
    assert.deepStrictEqual(rangeStart("30", [], NOW), at(2026, 8, 22, 0));
  });

  test("'all' starts at the earliest sale's day", () => {
    const sales = [sale(at(2026, 9, 1, 18), 5), sale(at(2026, 7, 4, 9), 5), sale(at(2026, 8, 1), 5)];
    assert.deepStrictEqual(rangeStart("all", sales, NOW), at(2026, 7, 4, 0));
  });

  test("'all' with no sales starts today", () => {
    assert.deepStrictEqual(rangeStart("all", [], NOW), at(2026, 9, 20, 0));
  });
});

describe("summarizeSales", () => {
  const start = at(2026, 9, 14, 0);

  test("revenue is what was paid, cost comes from the lines, profit is the difference", () => {
    const a = sale(at(2026, 9, 15), 38, "cash", 2); // 2 x 20 = 40, 2 off
    const b = sale(at(2026, 9, 16), 10, "momo");
    const lines = [line(a, 2, 20, 12), line(b, 1, 10, 6, "p2", "Bread")];
    const result = summarizeSales([a, b], lines, start);
    assert.strictEqual(result.revenue, 48);
    assert.strictEqual(result.cogs, 30); // 24 + 6
    assert.strictEqual(result.profit, 18);
    assert.strictEqual(result.marginPct, 38); // 18 / 48 = 37.5% rounds to 38
  });

  test("sales and their lines from before the period are excluded together", () => {
    const old = sale(at(2026, 9, 1), 100);
    const recent = sale(at(2026, 9, 18), 10);
    const lines = [line(old, 5, 20, 15), line(recent, 1, 10, 4)];
    const result = summarizeSales([old, recent], lines, start);
    assert.strictEqual(result.revenue, 10);
    assert.strictEqual(result.cogs, 4, "old sale's cost must not leak into this period");
    assert.strictEqual(result.profit, 6);
  });

  test("a sale exactly at the start of the period is included", () => {
    const edge = sale(at(2026, 9, 14, 0), 7);
    assert.strictEqual(summarizeSales([edge], [], start).revenue, 7);
  });

  test("payment totals add up to revenue and count each sale once", () => {
    const sales = [
      sale(at(2026, 9, 15), 10.1, "cash"),
      sale(at(2026, 9, 15), 20.2, "momo"),
      sale(at(2026, 9, 16), 5.05, "cash"),
      sale(at(2026, 9, 17), 1.01, "card"),
    ];
    const result = summarizeSales(sales, [], start);
    assert.deepStrictEqual(result.payments.map((p) => [p.method, p.value, p.count]), [
      ["cash", 15.15, 2],
      ["momo", 20.2, 1],
      ["card", 1.01, 1],
    ]);
    const sum = result.payments.reduce((total, p) => total + p.value, 0);
    assert.strictEqual(Math.round(sum * 100), Math.round(result.revenue * 100));
  });

  test("a zero-revenue period has no divide-by-zero margin", () => {
    const result = summarizeSales([], [], start);
    assert.strictEqual(result.revenue, 0);
    assert.strictEqual(result.marginPct, 0);
  });

  test("a loss shows as negative profit", () => {
    const s = sale(at(2026, 9, 15), 5);
    const result = summarizeSales([s], [line(s, 1, 5, 9)], start);
    assert.strictEqual(result.profit, -4);
  });

  test("top products are ranked by sales value, limited to 5, and skip unnamed lines", () => {
    const s = sale(at(2026, 9, 15), 0);
    const lines: ReportLine[] = [
      line(s, 1, 10, 1, "a", "A"),
      line(s, 3, 10, 1, "b", "B"),
      line(s, 2, 10, 1, "c", "C"),
      line(s, 1, 50, 1, "d", "D"),
      line(s, 1, 5, 1, "e", "E"),
      line(s, 1, 1, 1, "f", "F"),
      { sale_id: s.id, quantity: 9, unit_price: 100, unit_cost: 1 }, // no product info
    ];
    const result = summarizeSales([s], lines, start);
    assert.deepStrictEqual(result.topProducts.map((p) => p.name), ["D", "B", "C", "A", "E"]);
    assert.strictEqual(result.topProducts[1].units, 3);
  });

  test("a pack counts as the single items it holds, and its cost is the pack's cost", () => {
    const s = sale(at(2026, 9, 20), 90);
    const packLine: ReportLine = { ...line(s, 2, 40, 24, "p1", "Water"), unit_quantity: 12 };   // 2 packs of 12
    const singles: ReportLine = { ...line(s, 10, 1, 2, "p1", "Water"), unit_quantity: 1 };      // 10 singles
    const oldRow = line(s, 3, 1, 2, "p1", "Water");                                             // from before pack sizes
    const result = summarizeSales([s], [packLine, singles, oldRow], at(2026, 9, 1), ["cash"]);
    assert.strictEqual(result.topProducts[0].units, 24 + 10 + 3);
    assert.strictEqual(result.cogs, 2 * 24 + 10 * 2 + 3 * 2);
    assert.strictEqual(result.topProducts[0].revenue, 2 * 40 + 10 + 3);
  });

  test("the same product across several sales is combined", () => {
    const a = sale(at(2026, 9, 15), 0);
    const b = sale(at(2026, 9, 16), 0);
    const result = summarizeSales([a, b], [line(a, 2, 4, 1), line(b, 3, 4, 1)], start);
    assert.deepStrictEqual(result.topProducts, [{ name: "Water", revenue: 20, units: 5 }]);
  });
});

describe("buildRevenueBuckets", () => {
  test("a 7 day range gives 7 daily buckets ending today", () => {
    const start = rangeStart("7", [], NOW);
    const { buckets, weekly } = buildRevenueBuckets([], start, NOW);
    assert.strictEqual(weekly, false);
    assert.strictEqual(buckets.length, 7);
    assert.deepStrictEqual(buckets[0].date, at(2026, 9, 14, 0));
    assert.deepStrictEqual(buckets[6].date, at(2026, 9, 20, 0));
  });

  test("sales land on the right calendar day, including the first and last", () => {
    const start = rangeStart("7", [], NOW);
    const sales = [
      sale(at(2026, 9, 14, 0), 1), // very start
      sale(at(2026, 9, 14, 23), 2),
      sale(at(2026, 9, 17, 10), 4),
      sale(at(2026, 9, 20, 14), 8), // today
      sale(at(2026, 9, 13, 23), 999), // just before the range: ignored
    ];
    const { buckets } = buildRevenueBuckets(sales, start, NOW);
    assert.deepStrictEqual(buckets.map((b) => b.value), [3, 0, 0, 4, 0, 0, 8]);
    assert.deepStrictEqual(buckets.map((b) => b.count), [2, 0, 0, 1, 0, 0, 1]);
  });

  test("the range switches from daily to weekly just past the threshold", () => {
    const daily = buildRevenueBuckets([], at(2026, 9, 20, 0), NOW);
    assert.strictEqual(daily.weekly, false);

    // Exactly WEEKLY_AFTER_DAYS days (start .. today inclusive) is still daily.
    const startDaily = new Date(NOW.getFullYear(), NOW.getMonth(), NOW.getDate() - (WEEKLY_AFTER_DAYS - 1));
    const atLimit = buildRevenueBuckets([], startDaily, NOW);
    assert.strictEqual(atLimit.weekly, false);
    assert.strictEqual(atLimit.buckets.length, WEEKLY_AFTER_DAYS);

    // One more day flips to weekly.
    const startWeekly = new Date(NOW.getFullYear(), NOW.getMonth(), NOW.getDate() - WEEKLY_AFTER_DAYS);
    const over = buildRevenueBuckets([], startWeekly, NOW);
    assert.strictEqual(over.weekly, true);
    assert.strictEqual(over.buckets.length, Math.ceil((WEEKLY_AFTER_DAYS + 1) / 7));
  });

  test("weekly buckets keep every sale: nothing is dropped or double counted", () => {
    const start = at(2026, 1, 1, 0);
    const sales: ReportSale[] = [];
    for (let i = 0; i < 260; i += 1) sales.push(sale(at(2026, 1, 1 + i, 9 + (i % 9)), 10 + (i % 7)));
    const inRange = sales.filter((s) => new Date(s.created_at) <= NOW);
    const { buckets, weekly } = buildRevenueBuckets(inRange, start, NOW);
    assert.strictEqual(weekly, true);
    const bucketTotal = Math.round(buckets.reduce((sum, b) => sum + b.value, 0) * 100);
    const salesTotal = Math.round(inRange.reduce((sum, s) => sum + s.total, 0) * 100);
    assert.strictEqual(bucketTotal, salesTotal);
    assert.strictEqual(buckets.reduce((sum, b) => sum + b.count, 0), inRange.length);
  });

  test("daylight-saving changes do not shift sales onto the wrong day", () => {
    // Spans both the March and November US changes and the March/October EU changes.
    const start = at(2026, 3, 1, 0);
    const now = at(2026, 4, 5, 20);
    const sales = [
      sale(at(2026, 3, 7, 23), 1), // evening before a spring-forward
      sale(at(2026, 3, 8, 0), 2), // midnight of the change day
      sale(at(2026, 3, 8, 12), 4),
      sale(at(2026, 3, 9, 0), 8), // first midnight after it
      sale(at(2026, 3, 29, 12), 16), // EU change day
      sale(at(2026, 3, 30, 0), 32),
    ];
    const { buckets } = buildRevenueBuckets(sales, start, now);
    const valueOn = (y: number, m: number, d: number) =>
      buckets.find((b) => b.date.getTime() === at(y, m, d, 0).getTime())?.value;
    assert.strictEqual(valueOn(2026, 3, 7), 1);
    assert.strictEqual(valueOn(2026, 3, 8), 6);
    assert.strictEqual(valueOn(2026, 3, 9), 8);
    assert.strictEqual(valueOn(2026, 3, 29), 16);
    assert.strictEqual(valueOn(2026, 3, 30), 32);
    assert.strictEqual(buckets.length, 36);
  });
});
