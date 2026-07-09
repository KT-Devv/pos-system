import { ipcMain } from 'electron';
import { getDatabase, saveDatabase } from '../db/index.js';
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

export function registerSalesHandlers(): void {
  ipcMain.handle('sales:create', async (_event, sale: any) => {
    const db = await getDatabase();
    const saleId = randomUUID();

    db.run(
      `INSERT INTO sales (id, cashier_id, total, discount, payment_method)
       VALUES (?, ?, ?, ?, ?)`,
      [saleId, sale.cashier_id, sale.total, sale.discount, sale.payment_method]
    );

    for (const item of sale.items) {
      db.run(
        `INSERT INTO sale_items (id, sale_id, product_id, quantity, price, cost_price)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [randomUUID(), saleId, item.product_id, item.quantity, item.price, item.cost_price]
      );
      db.run(
        `UPDATE products SET stock = stock - ? WHERE id = ?`,
        [item.quantity, item.product_id]
      );
      db.run(
        `INSERT INTO stock_history (id, product_id, type, quantity, notes)
         VALUES (?, ?, 'out', ?, ?)`,
        [randomUUID(), item.product_id, item.quantity, `Sale #${saleId.slice(0, 8)}`]
      );
    }

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
      conditions.push("s.created_at <= ?");
      params.push(filters.endDate);
    }

    if (conditions.length > 0) {
      sql += ` WHERE ${conditions.join(' AND ')}`;
    }
    sql += ` ORDER BY s.created_at DESC`;
    if (filters?.limit) {
      sql += ` LIMIT ${filters.limit}`;
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
    const today = new Date().toISOString().split('T')[0];
    const stats = queryOne(db,
      `SELECT
        COALESCE(SUM(total), 0) as totalSales,
        COALESCE(SUM(total - discount), 0) as netSales,
        COUNT(*) as transactionCount
       FROM sales WHERE DATE(created_at) = ?`,
      [today]
    );

    const profit = queryOne(db,
      `SELECT COALESCE(SUM(si.quantity * (si.price - si.cost_price)), 0) as totalProfit
       FROM sale_items si
       JOIN sales s ON si.sale_id = s.id
       WHERE DATE(s.created_at) = ?`,
      [today]
    );

    return { ...stats, profit: profit?.totalProfit || 0 };
  });

  ipcMain.handle('sales:stats', async (_event, period: string) => {
    const db = await getDatabase();
    let dateFormat: string;
    switch (period) {
      case 'daily': dateFormat = '%Y-%m-%d'; break;
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
