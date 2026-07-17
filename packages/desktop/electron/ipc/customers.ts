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

export function registerCustomerHandlers(): void {
  ipcMain.handle('customers:list', async (_event, search?: string) => {
    const db = await getDatabase();
    if (search) {
      return queryAll(db,
        'SELECT * FROM customers WHERE name LIKE ? OR phone LIKE ? ORDER BY name',
        [`%${search}%`, `%${search}%`]
      );
    }
    return queryAll(db, 'SELECT * FROM customers ORDER BY name');
  });

  ipcMain.handle('customers:get', async (_event, id: string) => {
    const db = await getDatabase();
    return queryOne(db, 'SELECT * FROM customers WHERE id = ?', [id]);
  });

  ipcMain.handle('customers:create', async (_event, customer: any) => {
    const db = await getDatabase();
    const id = randomUUID();
    db.run(
      'INSERT INTO customers (id, name, phone, email) VALUES (?, ?, ?, ?)',
      [id, customer.name, customer.phone || null, customer.email || null]
    );
    saveDatabase();
    return queryOne(db, 'SELECT * FROM customers WHERE id = ?', [id]);
  });

  ipcMain.handle('customers:update', async (_event, id: string, customer: any) => {
    const db = await getDatabase();
    const fields: string[] = [];
    const values: any[] = [];

    if (customer.name !== undefined) { fields.push('name = ?'); values.push(customer.name); }
    if (customer.phone !== undefined) { fields.push('phone = ?'); values.push(customer.phone); }
    if (customer.email !== undefined) { fields.push('email = ?'); values.push(customer.email); }
    if (customer.loyalty_points !== undefined) { fields.push('loyalty_points = ?'); values.push(customer.loyalty_points); }

    if (fields.length > 0) {
      values.push(id);
      db.run(`UPDATE customers SET ${fields.join(', ')} WHERE id = ?`, values);
      saveDatabase();
    }
    return queryOne(db, 'SELECT * FROM customers WHERE id = ?', [id]);
  });

  ipcMain.handle('customers:delete', async (_event, id: string) => {
    const db = await getDatabase();
    db.run('DELETE FROM customers WHERE id = ?', [id]);
    saveDatabase();
    return { success: true };
  });
}
