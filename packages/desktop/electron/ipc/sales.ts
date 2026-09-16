import { ipcMain } from 'electron';
import { getDatabase, saveDatabase } from '../db/index.js';
import { parseLimit, runTransaction } from '../lib/db-helpers.js';
import { randomUUID } from 'crypto';

function queryAll(db: any, sql: string, params: any[] = []): any[] {
  const stmt = db.prepare(sql);
  stmt.bind(params);
  const results: any[] = [];
  while (stmt.step()) {
    results.push(stmt.getAsObject());
  }
  stmt.free();
  return results;
}

function queryOne(db: any, sql: string, params: any[] = []): any {
  const results = queryAll(db, sql, params);
  return results[0] || null;
}

function verifyStock(db: any, items: any[]): void {
  const requested = new Map<string, number>();
  for (const item of items) {
    const quantity = Math.floor(Number(item.quantity));
    if (!Number.isFinite(quantity) || quantity <= 0) {
      throw new Error('Invalid item quantity');
    }
    if (!item.product_id) {
      throw new Error('Product is required');
    }
    requested.set(item.product_id, (requested.get(item.product_id) || 0) + quantity);
  }

  const stockQuery = db.prepare('SELECT stock FROM products WHERE id = ?');
  try {
    for (const [productId, quantity] of requested) {
      stockQuery.bind([productId]);
      let row: any = null;
      if (stockQuery.step()) row = stockQuery.getAsObject();
      stockQuery.reset();
      if (!row) {
        throw new Error(`Product not found: ${productId}`);
      }
      const available = row ? Number(row.stock) : 0;
      if (quantity > available) {
        throw new Error(`Insufficient stock for product ${productId}: only ${available} available`);
      }
    }
  } finally {
    stockQuery.free();
  }
}

export function registerSalesHandlers(): void {
  ipcMain.handle('sales:create', async (_event, sale: any) => {
    const db = await getDatabase();
    const saleId = randomUUID();

    const items: any[] = Array.isArray(sale?.items) ? sale.items : [];
    if (items.length === 0) {
      throw new Error('Sale must contain at least one item');
    }

    const cashierId = sale.cashier_id;
    if (!cashierId) throw new Error('Cashier is required');

    const paymentMethod = sale.payment_method;
    if (!['cash', 'momo', 'card'].includes(paymentMethod)) {
      throw new Error('Invalid payment method');
    }

    const requestedDiscount =
      sale.discount === undefined || sale.discount === null
        ? 0
        : Number(sale.discount);
    if (!Number.isFinite(requestedDiscount) || requestedDiscount < 0) {
      throw new Error('Discount must be a finite non-negative number');
    }

    // Verify stock sufficiency before writing anything (frees statement on error too)
    verifyStock(db, items);

    const normalizedItems = items.map((item) => {
      const product = queryOne(
        db,
        'SELECT selling_price, cost_price FROM products WHERE id = ?',
        [item.product_id],
      );
      if (!product) throw new Error(`Product not found: ${item.product_id}`);
      return {
        ...item,
        price: Number(product.selling_price),
        cost_price: Number(product.cost_price),
      };
    });
    const subtotal = normalizedItems.reduce(
      (sum, item) => sum + item.price * Math.floor(Number(item.quantity)),
      0,
    );
    const discount = Math.min(requestedDiscount, subtotal);
    const total = Math.max(0, subtotal - discount);

    runTransaction(db, () => {
      db.run(
        `INSERT INTO sales (id, cashier_id, total, discount, payment_method)
         VALUES (?, ?, ?, ?, ?)`,
        [saleId, cashierId, total, discount, paymentMethod]
      );

      for (const item of normalizedItems) {
        const quantity = Math.floor(Number(item.quantity));
        db.run(
          `INSERT INTO sale_items (id, sale_id, product_id, quantity, price, cost_price)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [randomUUID(), saleId, item.product_id, quantity, item.price, item.cost_price]
        );
        db.run(
          `UPDATE products SET stock = stock - ? WHERE id = ?`,
          [quantity, item.product_id]
        );
        db.run(
          `INSERT INTO stock_history (id, product_id, type, quantity, notes)
           VALUES (?, ?, 'out', ?, ?)`,
          [randomUUID(), item.product_id, quantity, `Sale #${saleId.slice(0, 8)}`]
        );
      }
    });

    saveDatabase();
    return queryOne(db, 'SELECT * FROM sales WHERE id = ?', [saleId]);
  });

  ipcMain.handle('sales:list', async (_event, filters?: any) => {
    const db = await getDatabase();
    let sql = `SELECT s.*, u.name as cashier_name FROM sales s LEFT JOIN users u ON s.cashier_id = u.id`;
    const conditions: string[] = [];
    const params: any[] = [];

    if (filters?.startDate) {
      conditions.push("s.created_at >= ?");
      params.push(filters.startDate);
    }
    if (filters?.endDate) {
      conditions.push("s.created_at < date(?, '+1 day')");
      params.push(String(filters.endDate).slice(0, 10));
    }

    if (conditions.length > 0) {
      sql += ` WHERE ${conditions.join(' AND ')}`;
    }
    sql += ` ORDER BY s.created_at DESC`;
    const limit = parseLimit(filters?.limit, 100);
    if (limit > 0) {
      sql += ` LIMIT ?`;
      params.push(limit);
    }

    return queryAll(db, sql, params);
  });

  ipcMain.handle('sales:getWithItems', async (_event, saleId: string) => {
    const db = await getDatabase();
    const sale = queryOne(db,
      `SELECT s.*, u.name as cashier_name FROM sales s LEFT JOIN users u ON s.cashier_id = u.id WHERE s.id = ?`,
      [saleId]
    );
    const items = queryAll(db,
      `SELECT si.*, p.name as product_name FROM sale_items si LEFT JOIN products p ON si.product_id = p.id WHERE si.sale_id = ?`,
      [saleId]
    );
    return { ...sale, items };
  });

  ipcMain.handle('sales:todayStats', async () => {
    const db = await getDatabase();

    // Local-day boundaries (the shop's day, not UTC)
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startIso = start.toISOString();
    const endIso = new Date(start.getTime() + 86400000).toISOString();

    const stats = queryOne(db,
      `SELECT
        COALESCE(SUM(total + discount), 0) as totalSales,
        COALESCE(SUM(total), 0) as netSales,
        COUNT(*) as transactionCount
       FROM sales WHERE created_at >= ? AND created_at < ?`,
      [startIso, endIso]
    );

    const profit = queryOne(db,
      `SELECT COALESCE(SUM(si.quantity * (si.price - si.cost_price)), 0) - COALESCE(SUM(s.discount), 0) as totalProfit
       FROM sale_items si
       JOIN sales s ON si.sale_id = s.id
       WHERE s.created_at >= ? AND s.created_at < ?`,
      [startIso, endIso]
    );

    return { ...stats, profit: profit?.totalProfit || 0 };
  });

  ipcMain.handle('sales:stats', async (_event, period: string) => {
    const db = await getDatabase();
    let dateFormat: string;
    switch (period) {
      case 'daily': dateFormat = "%Y-%m-%d"; break;
      case 'weekly': dateFormat = "%G-W%V"; break;
      case 'monthly': dateFormat = "%Y-%m"; break;
      default: dateFormat = "%Y-%m-%d";
    }
    return queryAll(db,
      `SELECT
        strftime('${dateFormat}', created_at, 'localtime') as period,
        SUM(total) as totalSales,
        COUNT(*) as transactionCount,
        SUM(sale_profit.profit) as profit
       FROM sales
       LEFT JOIN (
         SELECT s2.id as sale_id,
           SUM(si.quantity * (si.price - si.cost_price)) - s2.discount as profit
         FROM sale_items si
         JOIN sales s2 ON si.sale_id = s2.id
         GROUP BY s2.id
       ) sale_profit ON sale_profit.sale_id = sales.id
       GROUP BY period
       ORDER BY period DESC
       LIMIT 30`
    );
  });
}
