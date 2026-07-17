import { ipcMain } from 'electron';
import { getDatabase, saveDatabase } from '../db/index.js';
import { randomUUID } from 'crypto';
import { queryAll, queryOne, runTransaction, parseLimit, assertPositiveInt } from '../lib/db-helpers.js';
import { requireSession, requireAdmin } from '../lib/session.js';

function applyStockChange(
  db: Awaited<ReturnType<typeof getDatabase>>,
  type: 'in' | 'out' | 'adjustment',
  productId: string,
  quantity: number,
  supplierId: string | null,
  notes: string | null
): string {
  const id = randomUUID();

  if (type === 'out') {
    const qty = assertPositiveInt(quantity, 'quantity');
    const product = queryOne(db, 'SELECT stock FROM products WHERE id = ?', [productId]);
    if (!product || (product.stock as number) < qty) throw new Error('Insufficient stock');
    db.run(`UPDATE products SET stock = stock - ? WHERE id = ?`, [qty, productId]);
  } else if (type === 'adjustment') {
    const delta = typeof quantity === 'number' ? quantity : parseInt(String(quantity), 10);
    if (!Number.isInteger(delta) || delta === 0) throw new Error('Invalid adjustment quantity');
    const product = queryOne(db, 'SELECT stock FROM products WHERE id = ?', [productId]);
    if (!product) throw new Error('Product not found');
    if ((product.stock as number) + delta < 0) throw new Error('Adjustment would result in negative stock');
    db.run(`UPDATE products SET stock = stock + ? WHERE id = ?`, [delta, productId]);
    db.run(
      `INSERT INTO stock_history (id, product_id, type, quantity, supplier_id, notes)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [id, productId, type, Math.abs(delta), supplierId, notes]
    );
    return id;
  } else {
    const qty = assertPositiveInt(quantity, 'quantity');
    db.run(`UPDATE products SET stock = stock + ? WHERE id = ?`, [qty, productId]);

    db.run(
      `INSERT INTO stock_history (id, product_id, type, quantity, supplier_id, notes)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [id, productId, type, qty, supplierId, notes]
    );
    return id;
  }

  db.run(
    `INSERT INTO stock_history (id, product_id, type, quantity, supplier_id, notes)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [id, productId, type, Math.abs(Number(quantity)), supplierId, notes]
  );
  return id;
}

export function registerInventoryHandlers(): void {
  ipcMain.handle('inventory:stockIn', async (_event, token: string, entry: { product_id: string; quantity: number; supplier_id?: string; notes?: string }) => {
    requireAdmin(token);
    const db = await getDatabase();
    let id: string;
    runTransaction(db, () => {
      id = applyStockChange(db, 'in', entry.product_id, entry.quantity, entry.supplier_id || null, entry.notes || null);
    });
    saveDatabase();
    return queryOne(db, 'SELECT * FROM stock_history WHERE id = ?', [id!]);
  });

  ipcMain.handle('inventory:stockOut', async (_event, token: string, entry: { product_id: string; quantity: number; notes?: string }) => {
    requireAdmin(token);
    const db = await getDatabase();
    let id: string;
    runTransaction(db, () => {
      id = applyStockChange(db, 'out', entry.product_id, entry.quantity, null, entry.notes || null);
    });
    saveDatabase();
    return queryOne(db, 'SELECT * FROM stock_history WHERE id = ?', [id!]);
  });

  ipcMain.handle('inventory:adjust', async (_event, token: string, entry: { product_id: string; quantity: number; notes?: string }) => {
    requireAdmin(token);
    const db = await getDatabase();
    let id: string;
    runTransaction(db, () => {
      id = applyStockChange(db, 'adjustment', entry.product_id, entry.quantity, null, entry.notes || null);
    });
    saveDatabase();
    return queryOne(db, 'SELECT * FROM stock_history WHERE id = ?', [id!]);
  });

  ipcMain.handle('inventory:history', async (_event, token: string, filters?: { product_id?: string; limit?: number }) => {
    requireSession(token);
    const db = await getDatabase();
    let sql = `SELECT sh.*, p.name as product_name, s.name as supplier_name
               FROM stock_history sh
               LEFT JOIN products p ON sh.product_id = p.id
               LEFT JOIN suppliers s ON sh.supplier_id = s.id`;
    const conditions: string[] = [];
    const params: unknown[] = [];

    if (filters?.product_id) {
      conditions.push('sh.product_id = ?');
      params.push(filters.product_id);
    }

    if (conditions.length > 0) sql += ` WHERE ${conditions.join(' AND ')}`;
    sql += ` ORDER BY sh.created_at DESC LIMIT ?`;
    params.push(parseLimit(filters?.limit, 100));

    return queryAll(db, sql, params);
  });

  ipcMain.handle('inventory:lowStock', async (_event, token: string) => {
    requireSession(token);
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
