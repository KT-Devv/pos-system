import { ipcMain } from 'electron';
import { getDatabase, saveDatabase } from '../db/index.js';
import { randomUUID } from 'crypto';
import { queryAll, queryOne } from '../lib/db-helpers.js';
import { requireSession, requireAdmin } from '../lib/session.js';

export function registerCustomerHandlers(): void {
  ipcMain.handle('customers:list', async (_event, token: string, search?: string) => {
    requireSession(token);
    const db = await getDatabase();
    if (search) {
      return queryAll(db,
        'SELECT * FROM customers WHERE name LIKE ? OR phone LIKE ? ORDER BY name',
        [`%${search}%`, `%${search}%`]
      );
    }
    return queryAll(db, 'SELECT * FROM customers ORDER BY name');
  });

  ipcMain.handle('customers:get', async (_event, token: string, id: string) => {
    requireSession(token);
    const db = await getDatabase();
    return queryOne(db, 'SELECT * FROM customers WHERE id = ?', [id]);
  });

  ipcMain.handle('customers:create', async (_event, token: string, customer: { name: string; phone?: string; email?: string }) => {
    requireSession(token);
    if (!customer.name?.trim()) throw new Error('Customer name is required');
    const db = await getDatabase();
    const id = randomUUID();
    db.run(
      'INSERT INTO customers (id, name, phone, email) VALUES (?, ?, ?, ?)',
      [id, customer.name, customer.phone || null, customer.email || null]
    );
    saveDatabase();
    return queryOne(db, 'SELECT * FROM customers WHERE id = ?', [id]);
  });

  ipcMain.handle('customers:update', async (_event, token: string, id: string, customer: Record<string, unknown>) => {
    requireSession(token);
    const db = await getDatabase();
    const fields: string[] = [];
    const values: unknown[] = [];

    for (const key of ['name', 'phone', 'email', 'loyalty_points']) {
      if (customer[key] !== undefined) {
        fields.push(`${key} = ?`);
        values.push(customer[key]);
      }
    }

    if (fields.length > 0) {
      values.push(id);
      db.run(`UPDATE customers SET ${fields.join(', ')} WHERE id = ?`, values);
      saveDatabase();
    }
    return queryOne(db, 'SELECT * FROM customers WHERE id = ?', [id]);
  });

  ipcMain.handle('customers:delete', async (_event, token: string, id: string) => {
    requireAdmin(token);
    const db = await getDatabase();
    db.run('DELETE FROM customers WHERE id = ?', [id]);
    saveDatabase();
    return { success: true };
  });
}
