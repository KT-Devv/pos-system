import { ipcMain } from 'electron';
import { getDatabase, saveDatabase } from '../db/index.js';
import { randomUUID } from 'crypto';
import { queryAll, queryOne } from '../lib/db-helpers.js';
import { requireSession, requireAdmin } from '../lib/session.js';
import type { SqlValue } from 'sql.js';

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
    const name = String(product.name ?? '').trim();
    const costPrice = Number(product.cost_price ?? 0);
    const sellingPrice = Number(product.selling_price ?? 0);
    if (!name) throw new Error('Product name is required');
    if (!Number.isFinite(costPrice) || costPrice < 0) throw new Error('Cost price must be a non-negative number');
    if (!Number.isFinite(sellingPrice) || sellingPrice < 0) throw new Error('Selling price must be a non-negative number');
    const id = randomUUID();
    const initialStock = Math.max(0, Number(product.stock ?? 0));
    const packQuantity = Math.max(0, Number(product.pack_quantity ?? 0));
    const qtyToRecord = initialStock > 0 ? initialStock : packQuantity;

    db.run(
      `INSERT INTO products (id, name, category_id, cost_price, selling_price, stock, barcode, qr_code, image)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        name,
        (product.category_id as SqlValue) || null,
        costPrice,
        sellingPrice,
        qtyToRecord,
        (product.barcode as SqlValue) || null,
        (product.qr_code as SqlValue) || null,
        (product.image as SqlValue) || null,
      ]
    );

    if (qtyToRecord > 0) {
      const detailParts = [
        product.measurement_unit?.toString().trim() || null,
        product.pack_quantity ? `pack ${product.pack_quantity}` : null,
        product.unit_cost != null ? `unit cost ${product.unit_cost}` : null,
      ].filter(Boolean) as string[];
      const noteText = detailParts.length > 0 ? detailParts.join(' • ') : null;
      db.run(
        `INSERT INTO stock_history (id, product_id, type, quantity, supplier_id, notes)
         VALUES (?, ?, 'in', ?, ?, ?)`,
        [randomUUID(), id, qtyToRecord, null, noteText || `Initial stock for ${name}`]
      );
    }

    saveDatabase();
    return queryOne(db, 'SELECT * FROM products WHERE id = ?', [id]);
  });

  ipcMain.handle('products:update', async (_event, token: string, id: string, product: Record<string, unknown>) => {
    requireAdmin(token);
    const db = await getDatabase();
    const fields: string[] = [];
    const values: SqlValue[] = [];

    for (const key of ['name', 'category_id', 'cost_price', 'selling_price', 'stock', 'barcode', 'qr_code', 'image']) {
      if (product[key] !== undefined) {
        fields.push(`${key} = ?`);
        values.push(product[key] as SqlValue);
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
