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
    let sql = `SELECT s.*, u.name as cashier_name FROM sales s LEFT JOIN users u ON s.cashier_id = u.id`;
    const conditions: string[] = [];
    const params: unknown[] = [];

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

    const profit = queryOne(db,
      `SELECT COALESCE(SUM(si.quantity * (si.price - si.cost_price)), 0) as totalProfit
       FROM sale_items si
       JOIN sales s ON si.sale_id = s.id
       WHERE date(s.created_at) = ?`,
      [today]
    );

    return { ...stats, profit: profit?.totalProfit || 0 };
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
}
