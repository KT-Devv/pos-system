import { ipcMain } from 'electron';
import { getDatabase, saveDatabase } from '../db/index.js';
import { queryAll } from '../lib/db-helpers.js';
import { hashPin, verifyPin } from '../lib/pin.js';
import { createSession, destroySession } from '../lib/session.js';

export function registerAuthHandlers(): void {
  ipcMain.handle('auth:login', async (_event, pin: string) => {
    if (!pin || pin.length < 4) throw new Error('PIN must be at least 4 digits');
    const db = await getDatabase();
    const users = queryAll(db, 'SELECT id, name, role, pin FROM users') as { id: string; name: string; role: string; pin: string }[];
    if (!users.length) throw new Error('Invalid PIN');

    for (const { id, name, role, pin: storedPin } of users) {
      if (verifyPin(pin, storedPin)) {
        if (!storedPin.includes(':')) {
          db.run('UPDATE users SET pin = ? WHERE id = ?', [hashPin(pin), id]);
          saveDatabase();
        }
        const sessionToken = createSession({ id, name, role });
        return { user: { id, name, role }, sessionToken };
      }
    }
    throw new Error('Invalid PIN');
  });

  ipcMain.handle('auth:logout', async (_event, token: string) => {
    destroySession(token);
    return { success: true };
  });
}
