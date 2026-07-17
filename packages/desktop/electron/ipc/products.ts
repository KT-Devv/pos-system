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

export function registerProductHandlers(): void {
  ipcMain.handle('products:list', async (_event, search?: string) => {
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

  ipcMain.handle('products:get', async (_event, id: string) => {
    const db = await getDatabase();
    return queryOne(db,
      `SELECT p.*, c.name as category_name FROM products p
       LEFT JOIN categories c ON p.category_id = c.id
       WHERE p.id = ?`,
      [id]
    );
  });

  ipcMain.handle('products:getByBarcode', async (_event, barcode: string) => {
    const db = await getDatabase();
    return queryOne(db,
      `SELECT p.*, c.name as category_name FROM products p
       LEFT JOIN categories c ON p.category_id = c.id
       WHERE p.barcode = ?`,
      [barcode]
    );
  });

  ipcMain.handle('products:create', async (_event, product: any) => {
    const db = await getDatabase();
    const id = randomUUID();
    db.run(
      `INSERT INTO products (id, name, category_id, cost_price, selling_price, stock, barcode, qr_code, image)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, product.name, product.category_id || null, product.cost_price, product.selling_price, product.stock || 0, product.barcode || null, product.qr_code || null, product.image || null]
    );
    saveDatabase();
    return queryOne(db, 'SELECT * FROM products WHERE id = ?', [id]);
  });

  ipcMain.handle('products:update', async (_event, id: string, product: any) => {
    const db = await getDatabase();
    const fields: string[] = [];
    const values: any[] = [];

    if (product.name !== undefined) { fields.push('name = ?'); values.push(product.name); }
    if (product.category_id !== undefined) { fields.push('category_id = ?'); values.push(product.category_id); }
    if (product.cost_price !== undefined) { fields.push('cost_price = ?'); values.push(product.cost_price); }
    if (product.selling_price !== undefined) { fields.push('selling_price = ?'); values.push(product.selling_price); }
    if (product.stock !== undefined) { fields.push('stock = ?'); values.push(product.stock); }
    if (product.barcode !== undefined) { fields.push('barcode = ?'); values.push(product.barcode); }
    if (product.qr_code !== undefined) { fields.push('qr_code = ?'); values.push(product.qr_code); }
    if (product.image !== undefined) { fields.push('image = ?'); values.push(product.image); }

    if (fields.length > 0) {
      values.push(id);
      db.run(`UPDATE products SET ${fields.join(', ')} WHERE id = ?`, values);
      saveDatabase();
    }
    return queryOne(db, 'SELECT * FROM products WHERE id = ?', [id]);
  });

  ipcMain.handle('products:delete', async (_event, id: string) => {
    const db = await getDatabase();
    db.run('DELETE FROM products WHERE id = ?', [id]);
    saveDatabase();
    return { success: true };
  });

  ipcMain.handle('products:stats', async () => {
    const db = await getDatabase();
    const total = queryOne(db, 'SELECT COUNT(*) as count FROM products');
    const lowStock = queryOne(db, `SELECT COUNT(*) as count FROM products WHERE stock <= CAST((SELECT value FROM settings WHERE key = 'low_stock_threshold') AS INTEGER)`);
    const outOfStock = queryOne(db, 'SELECT COUNT(*) as count FROM products WHERE stock = 0');
    return { total: total?.count || 0, lowStock: lowStock?.count || 0, outOfStock: outOfStock?.count || 0 };
  });
}
