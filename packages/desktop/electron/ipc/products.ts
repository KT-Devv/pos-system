import { ipcMain } from 'electron';
import { getDatabase, saveDatabase } from '../db/index.js';
import { randomUUID } from 'crypto';
import { queryAll, queryOne } from '../lib/db-helpers.js';
import { requireSession, requireAdmin } from '../lib/session.js';

export function registerProductHandlers(): void {
  ipcMain.handle('products:list', async (_event, token: string, search?: string) => {
    requireSession(token);
    const db = await getDatabase();
    if (search) {
      return queryAll(db,
        `SELECT p.*, c.name as category_name FROM products p
         LEFT JOIN categories c ON p.category_id = c.id
         WHERE p.name LIKE ? OR p.barcode LIKE ?
         ORDER BY p.name`,
        [`%${search}%`, `%${search}%`]
      );
    }
    return queryAll(db,
      `SELECT p.*, c.name as category_name FROM products p
       LEFT JOIN categories c ON p.category_id = c.id
       ORDER BY p.name`
    );
  });

  ipcMain.handle('products:get', async (_event, token: string, id: string) => {
    requireSession(token);
    const db = await getDatabase();
    return queryOne(db,
      `SELECT p.*, c.name as category_name FROM products p
       LEFT JOIN categories c ON p.category_id = c.id WHERE p.id = ?`,
      [id]
    );
  });

  ipcMain.handle('products:getByBarcode', async (_event, token: string, code: string) => {
    requireSession(token);
    const db = await getDatabase();
    return queryOne(db,
      `SELECT p.*, c.name as category_name FROM products p
       LEFT JOIN categories c ON p.category_id = c.id
       WHERE p.barcode = ? OR p.id = ?`,
      [code, code]
    );
  });

  ipcMain.handle('products:create', async (_event, token: string, product: Record<string, unknown>) => {
    requireAdmin(token);
    const db = await getDatabase();
    const id = randomUUID();
    db.run(
      `INSERT INTO products (id, name, category_id, cost_price, selling_price, stock, barcode, qr_code, image)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        product.name,
        product.category_id || null,
        product.cost_price,
        product.selling_price,
        product.stock || 0,
        product.barcode || null,
        product.qr_code || null,
        product.image || null,
      ]
    );
    saveDatabase();
    return queryOne(db, 'SELECT * FROM products WHERE id = ?', [id]);
  });

  ipcMain.handle('products:update', async (_event, token: string, id: string, product: Record<string, unknown>) => {
    requireAdmin(token);
    const db = await getDatabase();
    const fields: string[] = [];
    const values: unknown[] = [];

    for (const key of ['name', 'category_id', 'cost_price', 'selling_price', 'stock', 'barcode', 'qr_code', 'image']) {
      if (product[key] !== undefined) {
        fields.push(`${key} = ?`);
        values.push(product[key]);
      }
    }

    if (fields.length > 0) {
      values.push(id);
      db.run(`UPDATE products SET ${fields.join(', ')} WHERE id = ?`, values);
      saveDatabase();
    }
    return queryOne(db, 'SELECT * FROM products WHERE id = ?', [id]);
  });

  ipcMain.handle('products:delete', async (_event, token: string, id: string) => {
    requireAdmin(token);
    const db = await getDatabase();
    try {
      db.run('DELETE FROM products WHERE id = ?', [id]);
      saveDatabase();
    } catch {
      throw new Error('Cannot delete product: it may be referenced by past sales');
    }
    return { success: true };
  });

  ipcMain.handle('products:stats', async (_event, token: string) => {
    requireSession(token);
    const db = await getDatabase();
    const total = queryOne(db, 'SELECT COUNT(*) as count FROM products');
    const lowStock = queryOne(db,
      `SELECT COUNT(*) as count FROM products WHERE stock <= CAST((SELECT value FROM settings WHERE key = 'low_stock_threshold') AS INTEGER) AND stock > 0`
    );
    const outOfStock = queryOne(db, 'SELECT COUNT(*) as count FROM products WHERE stock = 0');
    return {
      total: total?.count || 0,
      lowStock: lowStock?.count || 0,
      outOfStock: outOfStock?.count || 0,
    };
  });
}
