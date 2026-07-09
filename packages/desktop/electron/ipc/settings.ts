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

export function registerSettingsHandlers(): void {
  ipcMain.handle('settings:get', async (_event, key?: string) => {
    const db = await getDatabase();
    if (key) {
      const row = queryOne(db, 'SELECT value FROM settings WHERE key = ?', [key]);
      return row?.value || null;
    }
    const rows = queryAll(db, 'SELECT key, value FROM settings');
    return Object.fromEntries(rows.map((r: any) => [r.key, r.value]));
  });

  ipcMain.handle('settings:set', async (_event, key: string, value: string) => {
    const db = await getDatabase();
    db.run(
      `INSERT INTO settings (key, value, updated_at) VALUES (?, ?, datetime('now'))
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
      [key, value]
    );
    saveDatabase();
    return { success: true };
  });

  ipcMain.handle('settings:setup', async (_event, setup: any) => {
    const db = await getDatabase();

    const settings: [string, string][] = [
      ['shop_name', setup.shop_name],
      ['shop_phone', setup.shop_phone],
      ['shop_address', setup.shop_address],
      ['currency', setup.currency],
      ['receipt_header', setup.shop_name],
      ['printer_type', setup.printer_type],
      ['printer_paper_size', setup.printer_paper_size],
      ['setup_complete', 'true'],
    ];

    for (const [key, value] of settings) {
      db.run(
        `INSERT INTO settings (key, value) VALUES (?, ?)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
        [key, value]
      );
    }

    db.run(
      'INSERT INTO users (id, name, pin, role) VALUES (?, ?, ?, ?)',
      [randomUUID(), setup.admin_name, setup.admin_pin, 'admin']
    );

    saveDatabase();
    return { success: true };
  });

  ipcMain.handle('categories:list', async () => {
    const db = await getDatabase();
    return queryAll(db, 'SELECT * FROM categories ORDER BY name');
  });

  ipcMain.handle('categories:create', async (_event, name: string) => {
    const db = await getDatabase();
    const id = randomUUID();
    db.run('INSERT INTO categories (id, name) VALUES (?, ?)', [id, name]);
    saveDatabase();
    return queryOne(db, 'SELECT * FROM categories WHERE id = ?', [id]);
  });

  ipcMain.handle('categories:delete', async (_event, id: string) => {
    const db = await getDatabase();
    db.run('DELETE FROM categories WHERE id = ?', [id]);
    saveDatabase();
    return { success: true };
  });

  ipcMain.handle('suppliers:list', async () => {
    const db = await getDatabase();
    return queryAll(db, 'SELECT * FROM suppliers ORDER BY name');
  });

  ipcMain.handle('suppliers:create', async (_event, supplier: any) => {
    const db = await getDatabase();
    const id = randomUUID();
    db.run(
      'INSERT INTO suppliers (id, name, phone, email, address) VALUES (?, ?, ?, ?, ?)',
      [id, supplier.name, supplier.phone || null, supplier.email || null, supplier.address || null]
    );
    saveDatabase();
    return queryOne(db, 'SELECT * FROM suppliers WHERE id = ?', [id]);
  });
}
