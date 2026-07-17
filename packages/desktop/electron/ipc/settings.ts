import { ipcMain } from 'electron';
import { getDatabase, saveDatabase } from '../db/index.js';
import { randomUUID } from 'crypto';
import { queryAll, queryOne, runTransaction } from '../lib/db-helpers.js';
import { requireSession, requireAdmin } from '../lib/session.js';

const SECRET_KEYS = new Set(['supabase_key', 'supabase_url']);

export function registerSettingsHandlers(): void {
  ipcMain.handle('settings:get', async (_event, token: string, key?: string) => {
    requireSession(token);
    const db = await getDatabase();
    if (key) {
      const row = queryOne(db, 'SELECT value FROM settings WHERE key = ?', [key]);
      return row?.value || null;
    }
    const rows = queryAll(db, 'SELECT key, value FROM settings');
    return Object.fromEntries(
      rows
        .filter((r) => !SECRET_KEYS.has(String(r.key)))
        .map((r) => [r.key, r.value])
    );
  });

  ipcMain.handle('settings:set', async (_event, token: string, key: string, value: string) => {
    requireAdmin(token);
    const db = await getDatabase();
    db.run(
      `INSERT INTO settings (key, value, updated_at) VALUES (?, ?, datetime('now'))
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
      [key, value]
    );
    saveDatabase();
    return { success: true };
  });

  ipcMain.handle('settings:setup', async (_event, setup: {
    shop_name: string;
    shop_phone: string;
    shop_address: string;
    currency: string;
    printer_type: string;
    printer_paper_size: string;
    admin_name: string;
    admin_pin: string;
  }) => {
    if (!setup.admin_name || !setup.admin_pin || setup.admin_pin.length < 4) {
      throw new Error('Admin name and PIN (min 4 digits) are required');
    }
    const db = await getDatabase();
    const existing = queryOne(db, "SELECT value FROM settings WHERE key = 'setup_complete'");
    if (existing?.value === 'true') throw new Error('Setup already completed');

    const { hashPin } = await import('../lib/pin.js');

    runTransaction(db, () => {
      const settings: [string, string][] = [
        ['shop_name', setup.shop_name],
        ['shop_phone', setup.shop_phone],
        ['shop_address', setup.shop_address],
        ['currency', setup.currency || 'GHS'],
        ['receipt_header', setup.shop_name],
        ['receipt_footer', 'Thank you for your purchase!'],
        ['receipt_note', 'See you again soon!'],
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
        [randomUUID(), setup.admin_name, hashPin(setup.admin_pin), 'admin']
      );
    });

    saveDatabase();
    return { success: true };
  });

  ipcMain.handle('settings:isSetupComplete', async () => {
    const db = await getDatabase();
    const row = queryOne(db, "SELECT value FROM settings WHERE key = 'setup_complete'");
    return row?.value === 'true';
  });

  ipcMain.handle('categories:list', async (_event, token: string) => {
    requireSession(token);
    const db = await getDatabase();
    return queryAll(db, 'SELECT * FROM categories ORDER BY name');
  });

  ipcMain.handle('categories:create', async (_event, token: string, name: string) => {
    requireAdmin(token);
    if (!name?.trim()) throw new Error('Category name is required');
    const db = await getDatabase();
    const id = randomUUID();
    try {
      db.run('INSERT INTO categories (id, name) VALUES (?, ?)', [id, name.trim()]);
      saveDatabase();
    } catch {
      throw new Error('Category already exists or could not be created');
    }
    return queryOne(db, 'SELECT * FROM categories WHERE id = ?', [id]);
  });

  ipcMain.handle('categories:delete', async (_event, token: string, id: string) => {
    requireAdmin(token);
    const db = await getDatabase();
    db.run('DELETE FROM categories WHERE id = ?', [id]);
    saveDatabase();
    return { success: true };
  });

  ipcMain.handle('suppliers:list', async (_event, token: string) => {
    requireSession(token);
    const db = await getDatabase();
    return queryAll(db, 'SELECT * FROM suppliers ORDER BY name');
  });

  ipcMain.handle('suppliers:create', async (_event, token: string, supplier: { name: string; phone?: string; email?: string; address?: string }) => {
    requireAdmin(token);
    if (!supplier.name?.trim()) throw new Error('Supplier name is required');
    const db = await getDatabase();
    const id = randomUUID();
    db.run(
      'INSERT INTO suppliers (id, name, phone, email, address) VALUES (?, ?, ?, ?, ?)',
      [id, supplier.name, supplier.phone || null, supplier.email || null, supplier.address || null]
    );
    saveDatabase();
    return queryOne(db, 'SELECT * FROM suppliers WHERE id = ?', [id]);
  });

  ipcMain.handle('users:create', async (_event, token: string, user: { name: string; pin: string; role: string }) => {
    requireAdmin(token);
    if (!user.name?.trim() || !user.pin || user.pin.length < 4) {
      throw new Error('Name and PIN (min 4 digits) are required');
    }
    if (!['admin', 'cashier'].includes(user.role)) throw new Error('Invalid role');
    const { hashPin } = await import('../lib/pin.js');
    const db = await getDatabase();
    const id = randomUUID();
    db.run('INSERT INTO users (id, name, pin, role) VALUES (?, ?, ?, ?)', [id, user.name, hashPin(user.pin), user.role]);
    saveDatabase();
    return queryOne(db, 'SELECT id, name, role FROM users WHERE id = ?', [id]);
  });

  ipcMain.handle('users:list', async (_event, token: string) => {
    requireAdmin(token);
    const db = await getDatabase();
    return queryAll(db, 'SELECT id, name, role, created_at FROM users ORDER BY name');
  });
}
