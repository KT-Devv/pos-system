import { ipcMain } from 'electron';
import { getDatabase } from '../db/index.js';
import { verifyPin } from '../lib/pin.js';
import { createSession, destroySession, getSession } from '../lib/session.js';

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

export function registerAuthHandlers(): void {
  ipcMain.handle('auth:login', async (_event, pin: string) => {
    const db = await getDatabase();
    const users = queryAll(db, 'SELECT id, name, role, pin FROM users');
    const user = users.find((u: any) => verifyPin(String(pin), String(u.pin)));
    if (!user) {
      return null;
    }
    const sessionToken = createSession({ id: user.id, name: user.name, role: user.role });
    return { user: { id: user.id, name: user.name, role: user.role }, sessionToken };
  });

  ipcMain.handle('auth:me', (_event, token: string) => {
    return getSession(token);
  });

  ipcMain.handle('auth:logout', (_event, token: string) => {
    destroySession(token);
    return { success: true };
  });
}
