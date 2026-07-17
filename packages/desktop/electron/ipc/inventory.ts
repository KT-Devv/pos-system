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

export function registerInventoryHandlers(): void {
  ipcMain.handle('inventory:stockIn', async (_event, entry: any) => {
    const db = await getDatabase();
    const id = randomUUID();

    db.run(
      `INSERT INTO stock_history (id, product_id, type, quantity, supplier_id, notes)
       VALUES (?, ?, 'in', ?, ?, ?)`,
      [id, entry.product_id, entry.quantity, entry.supplier_id || null, entry.notes || null]
    );
    db.run(
      `UPDATE products SET stock = stock + ? WHERE id = ?`,
      [entry.quantity, entry.product_id]
    );

    saveDatabase();
    return queryOne(db, 'SELECT * FROM stock_history WHERE id = ?', [id]);
  });

  ipcMain.handle('inventory:stockOut', async (_event, entry: any) => {
    const db = await getDatabase();
    const id = randomUUID();

    db.run(
      `INSERT INTO stock_history (id, product_id, type, quantity, notes)
       VALUES (?, ?, 'out', ?, ?)`,
      [id, entry.product_id, entry.quantity, entry.notes || null]
    );
    db.run(
      `UPDATE products SET stock = stock - ? WHERE id = ?`,
      [entry.quantity, entry.product_id]
    );

    saveDatabase();
    return queryOne(db, 'SELECT * FROM stock_history WHERE id = ?', [id]);
  });

  ipcMain.handle('inventory:adjust', async (_event, entry: any) => {
    const db = await getDatabase();
    const id = randomUUID();

    db.run(
      `INSERT INTO stock_history (id, product_id, type, quantity, notes)
       VALUES (?, ?, 'adjustment', ?, ?)`,
      [id, entry.product_id, entry.quantity, entry.notes || null]
    );
    db.run(
      `UPDATE products SET stock = stock + ? WHERE id = ?`,
      [entry.quantity, entry.product_id]
    );

    saveDatabase();
    return queryOne(db, 'SELECT * FROM stock_history WHERE id = ?', [id]);
  });

  ipcMain.handle('inventory:history', async (_event, filters?: any) => {
    const db = await getDatabase();
    let sql = `SELECT sh.*, p.name as product_name, s.name as supplier_name
               FROM stock_history sh
               LEFT JOIN products p ON sh.product_id = p.id
               LEFT JOIN suppliers s ON sh.supplier_id = s.id`;
    const conditions: string[] = [];
    const params: any[] = [];

    if (filters?.product_id) {
      conditions.push('sh.product_id = ?');
      params.push(filters.product_id);
    }

    if (conditions.length > 0) {
      sql += ` WHERE ${conditions.join(' AND ')}`;
    }
    sql += ` ORDER BY sh.created_at DESC`;
    if (filters?.limit) {
      sql += ` LIMIT ${filters.limit}`;
    }

    return queryAll(db, sql, params);
  });

  ipcMain.handle('inventory:lowStock', async () => {
    const db = await getDatabase();
    return queryAll(db,
      `SELECT p.*, c.name as category_name
       FROM products p
       LEFT JOIN categories c ON p.category_id = c.id
       WHERE p.stock <= CAST((SELECT value FROM settings WHERE key = 'low_stock_threshold') AS INTEGER)
       ORDER BY p.stock ASC`
    );
  });
}
