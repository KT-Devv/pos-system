import { ipcMain } from 'electron';
import { getDatabase, saveDatabase } from '../db/index.js';
import { randomUUID } from 'crypto';
import {
  queryAll,
  queryOne,
  runTransaction,
  parseLimit,
  assertPositiveInt,
  assertNonNegativeNumber,
} from '../lib/db-helpers.js';
import { requireSession } from '../lib/session.js';
import type { SqlValue } from 'sql.js';

interface SaleItemInput {
  product_id: string;
  quantity: number;
  price: number;
  cost_price: number;
}

interface SaleInput {
  cashier_id: string;
  total: number;
  discount: number;
  payment_method: string;
  items: SaleItemInput[];
}

interface ReportOptions {
  period?: string;
  startDate?: string;
  endDate?: string;
}

interface ReportSale {
  id: string;
  total: number;
  discount: number;
  created_at: string;
}

interface ReportItem {
  sale_id: string;
  product_id: string;
  product_name: string;
  quantity: number;
  price: number;
  cost_price: number;
}

interface TodaySaleRow {
  id: string;
  discount: number;
  quantity: number;
  price: number;
  cost_price: number;
}

function dateOnly(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function isDateOnly(value: string | undefined): value is string {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00`);
  return !Number.isNaN(parsed.getTime()) && dateOnly(parsed) === value;
}

function resolveReportRange(options: ReportOptions): { startDate: string; endDate: string } {
  const period = options.period ?? 'daily';
  const now = new Date();

  if (period === 'custom') {
    if (!isDateOnly(options.startDate) || !isDateOnly(options.endDate)) {
      throw new Error('A valid custom report date range is required');
    }
    if (options.startDate > options.endDate) {
      throw new Error('Report start date must be before the end date');
    }
    return { startDate: options.startDate, endDate: options.endDate };
  }

  if (period === 'weekly') {
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - now.getDay());
    return { startDate: dateOnly(start), endDate: dateOnly(now) };
  }

  if (period === 'monthly') {
    return {
      startDate: dateOnly(new Date(now.getFullYear(), now.getMonth(), 1)),
      endDate: dateOnly(now),
    };
  }

  return { startDate: dateOnly(now), endDate: dateOnly(now) };
}

function calculateSaleProfit(sale: ReportSale, items: ReportItem[]): number {
  const subtotal = items.reduce((sum, item) => sum + Number(item.price) * Number(item.quantity), 0);
  const rawProfit = items.reduce(
    (sum, item) => sum + (Number(item.price) - Number(item.cost_price)) * Number(item.quantity),
    0,
  );
  const discountRatio = subtotal > 0 ? Math.max(0, Number(sale.discount) || 0) / subtotal : 0;
  return rawProfit * Math.max(0, 1 - discountRatio);
}

function validateSale(db: Awaited<ReturnType<typeof getDatabase>>, sale: SaleInput): void {
  if (!sale.cashier_id) throw new Error('Cashier is required');
  if (!['cash', 'momo', 'card'].includes(sale.payment_method)) throw new Error('Invalid payment method');
  const discount = assertNonNegativeNumber(sale.discount, 'discount');
  const total = assertNonNegativeNumber(sale.total, 'total');
  if (!sale.items?.length) throw new Error('Sale must have at least one item');

  const cashier = queryOne(db, 'SELECT id FROM users WHERE id = ?', [sale.cashier_id]);
  if (!cashier) throw new Error('Invalid cashier');

  let subtotal = 0;
  for (const item of sale.items) {
    const qty = assertPositiveInt(item.quantity, 'quantity');
    const price = assertNonNegativeNumber(item.price, 'price');
    assertNonNegativeNumber(item.cost_price, 'cost_price');
    const product = queryOne(db, 'SELECT id, stock FROM products WHERE id = ?', [item.product_id]);
    if (!product) throw new Error(`Product not found: ${item.product_id}`);
    if ((product.stock as number) < qty) throw new Error(`Insufficient stock for product ${item.product_id}`);
    subtotal += price * qty;
  }

  if (discount > subtotal) throw new Error('Discount exceeds subtotal');
  if (Math.abs(total - (subtotal - discount)) > 0.01) throw new Error('Total does not match subtotal minus discount');
}

export function registerSalesHandlers(): void {
  ipcMain.handle('sales:create', async (_event, token: string, sale: SaleInput) => {
    const session = requireSession(token);
    const db = await getDatabase();
    validateSale(db, { ...sale, cashier_id: session.id });

    const saleId = randomUUID();

    runTransaction(db, () => {
      db.run(
        `INSERT INTO sales (id, cashier_id, total, discount, payment_method)
         VALUES (?, ?, ?, ?, ?)`,
        [saleId, session.id, sale.total, sale.discount, sale.payment_method]
      );

      for (const item of sale.items) {
        const qty = assertPositiveInt(item.quantity, 'quantity');
        db.run(
          `INSERT INTO sale_items (id, sale_id, product_id, quantity, price, cost_price)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [randomUUID(), saleId, item.product_id, qty, item.price, item.cost_price]
        );
        const product = queryOne(db, 'SELECT stock FROM products WHERE id = ?', [item.product_id]);
        if (!product || (product.stock as number) < qty) {
          throw new Error(`Insufficient stock for product ${item.product_id}`);
        }
        db.run(
          `UPDATE products SET stock = stock - ? WHERE id = ?`,
          [qty, item.product_id]
        );
        db.run(
          `INSERT INTO stock_history (id, product_id, type, quantity, notes)
           VALUES (?, ?, 'out', ?, ?)`,
          [randomUUID(), item.product_id, qty, `Sale #${saleId.slice(0, 8)}`]
        );
      }
    });

    saveDatabase();
    return queryOne(db, 'SELECT * FROM sales WHERE id = ?', [saleId]);
  });

  ipcMain.handle('sales:list', async (_event, token: string, filters?: { startDate?: string; endDate?: string; limit?: number }) => {
    requireSession(token);
    const db = await getDatabase();
    let sql = `SELECT s.*, u.name as cashier_name,
                      (SELECT group_concat(p.name, ', ')
                       FROM sale_items si2
                       LEFT JOIN products p ON p.id = si2.product_id
                       WHERE si2.sale_id = s.id) as item_names
               FROM sales s LEFT JOIN users u ON s.cashier_id = u.id`;
    const conditions: string[] = [];
    const params: SqlValue[] = [];

    if (filters?.startDate) {
      conditions.push('s.created_at >= ?');
      params.push(filters.startDate);
    }
    if (filters?.endDate) {
      conditions.push("date(s.created_at) <= date(?)");
      params.push(filters.endDate);
    }

    if (conditions.length > 0) sql += ` WHERE ${conditions.join(' AND ')}`;
    sql += ` ORDER BY s.created_at DESC LIMIT ?`;
    params.push(parseLimit(filters?.limit, 100));

    return queryAll(db, sql, params);
  });

  ipcMain.handle('sales:getWithItems', async (_event, token: string, saleId: string) => {
    requireSession(token);
    const db = await getDatabase();
    const sale = queryOne(db,
      `SELECT s.*, u.name as cashier_name FROM sales s LEFT JOIN users u ON s.cashier_id = u.id WHERE s.id = ?`,
      [saleId]
    );
    if (!sale) throw new Error('Sale not found');
    const items = queryAll(db,
      `SELECT si.*, p.name as product_name FROM sale_items si LEFT JOIN products p ON si.product_id = p.id WHERE si.sale_id = ?`,
      [saleId]
    );
    return { ...sale, items };
  });

  ipcMain.handle('sales:todayStats', async (_event, token: string) => {
    requireSession(token);
    const db = await getDatabase();
    const today = new Date().toLocaleDateString('en-CA');
    const stats = queryOne(db,
      `SELECT
        COALESCE(SUM(total), 0) as totalSales,
        COALESCE(SUM(total), 0) as netSales,
        COUNT(*) as transactionCount
       FROM sales WHERE date(created_at) = ?`,
      [today]
    );

    const saleRows = queryAll(db,
      `SELECT s.id, s.discount, si.quantity, si.price, si.cost_price
       FROM sales s
       JOIN sale_items si ON si.sale_id = s.id
       WHERE date(s.created_at) = ?`,
      [today]
    ) as unknown as TodaySaleRow[];
    const itemsBySale = new Map<string, TodaySaleRow[]>();
    for (const row of saleRows) {
      const items = itemsBySale.get(row.id) ?? [];
      items.push(row);
      itemsBySale.set(row.id, items);
    }
    let profit = 0;
    for (const [saleId, items] of itemsBySale) {
      const sale = items[0] as unknown as ReportSale;
      profit += calculateSaleProfit(sale, items as unknown as ReportItem[]);
      if (!saleId) continue;
    }

    return { ...stats, profit };
  });

  ipcMain.handle('sales:stats', async (_event, token: string, period: string) => {
    requireSession(token);
    const db = await getDatabase();
    let dateFormat: string;
    switch (period) {
      case 'weekly': dateFormat = '%Y-W%W'; break;
      case 'monthly': dateFormat = '%Y-%m'; break;
      default: dateFormat = '%Y-%m-%d';
    }
    return queryAll(db,
      `SELECT
        strftime('${dateFormat}', created_at) as period,
        SUM(total) as totalSales,
        COUNT(*) as transactionCount
       FROM sales
       GROUP BY period
       ORDER BY period DESC
       LIMIT 30`
    );
  });

  ipcMain.handle('sales:report', async (_event, token: string, options: ReportOptions = {}) => {
    requireSession(token);
    const db = await getDatabase();
    const { startDate, endDate } = resolveReportRange(options);

    const sales = queryAll(db,
      `SELECT s.id, s.total, s.discount, s.created_at
       FROM sales s
       WHERE date(s.created_at) BETWEEN date(?) AND date(?)
       ORDER BY s.created_at DESC`,
      [startDate, endDate]
    ) as unknown as ReportSale[];
    const items = queryAll(db,
      `SELECT si.sale_id, si.product_id, p.name as product_name,
              si.quantity, si.price, si.cost_price
       FROM sale_items si
       JOIN sales s ON s.id = si.sale_id
       LEFT JOIN products p ON p.id = si.product_id
       WHERE date(s.created_at) BETWEEN date(?) AND date(?)`,
      [startDate, endDate]
    ) as unknown as ReportItem[];

    const itemsBySale = new Map<string, ReportItem[]>();
    for (const item of items) {
      const saleItems = itemsBySale.get(item.sale_id) ?? [];
      saleItems.push(item);
      itemsBySale.set(item.sale_id, saleItems);
    }

    const totalSales = sales.reduce((sum, sale) => sum + Number(sale.total || 0), 0);
    const totalProfit = sales.reduce(
      (sum, sale) => sum + calculateSaleProfit(sale, itemsBySale.get(sale.id) ?? []),
      0,
    );

    const productTotals = new Map<string, { name: string; quantity: number; revenue: number; profit: number }>();
    for (const item of items) {
      const current = productTotals.get(item.product_id) ?? {
        name: item.product_name || 'Unknown', quantity: 0, revenue: 0, profit: 0,
      };
      current.quantity += Number(item.quantity || 0);
      current.revenue += Number(item.price || 0) * Number(item.quantity || 0);
      current.profit += (Number(item.price || 0) - Number(item.cost_price || 0)) * Number(item.quantity || 0);
      productTotals.set(item.product_id, current);
    }
    const topProducts = [...productTotals.values()]
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5);

    const dayTotals = new Map<string, { total: number; profit: number; transactions: number }>();
    for (const sale of sales) {
      const day = String(sale.created_at).slice(0, 10);
      const current = dayTotals.get(day) ?? { total: 0, profit: 0, transactions: 0 };
      current.total += Number(sale.total || 0);
      current.profit += calculateSaleProfit(sale, itemsBySale.get(sale.id) ?? []);
      current.transactions += 1;
      dayTotals.set(day, current);
    }
    const dailySales = [...dayTotals.entries()]
      .sort(([a], [b]) => b.localeCompare(a))
      .slice(0, 10)
      .map(([date, values]) => ({ date, ...values }));

    const paymentTotals = new Map<string, number>();
    const paymentRows = queryAll(db,
      `SELECT payment_method, SUM(total) as amount
       FROM sales
       WHERE date(created_at) BETWEEN date(?) AND date(?)
       GROUP BY payment_method`,
      [startDate, endDate]
    ) as unknown as Array<{ payment_method: string; amount: number }>;
    for (const row of paymentRows) paymentTotals.set(row.payment_method, Number(row.amount || 0));
    const paymentTotal = [...paymentTotals.values()].reduce((sum, amount) => sum + amount, 0);
    const paymentMethods = [...paymentTotals.entries()].map(([method, amount]) => ({
      method: method === 'momo' ? 'Mobile Money' : method.charAt(0).toUpperCase() + method.slice(1),
      amount,
      percentage: paymentTotal > 0 ? Math.round((amount / paymentTotal) * 100) : 0,
    }));

    return {
      periodData: {
        sales: totalSales,
        profit: totalProfit,
        transactions: sales.length,
        averageSale: sales.length > 0 ? totalSales / sales.length : 0,
      },
      topProducts,
      dailySales,
      paymentMethods,
      startDate,
      endDate,
    };
  });
}
