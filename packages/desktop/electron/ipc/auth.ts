import { ipcMain } from 'electron';
import { getDatabase } from '../db/index.js';

function queryOne(db: any, sql: string, params: any[] = []): any {
  const stmt = db.prepare(sql);
  stmt.bind(params);
  let row = null;
  if (stmt.step()) {
    row = stmt.getAsObject();
  }
  stmt.free();
  return row;
}

export function registerAuthHandlers(): void {
  ipcMain.handle('auth:login', async (_event, pin: string) => {
    const db = await getDatabase();
    const user = queryOne(db, 'SELECT id, name, role FROM users WHERE pin = ?', [pin]);
    return user;
  });
}
