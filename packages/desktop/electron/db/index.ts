import initSqlJs, { type Database as SqlJsDatabase } from 'sql.js';
import path from 'path';
import fs from 'fs';
import { app } from 'electron';
import { initializeDatabase } from './schema.js';
import { seedDefaultData } from './seed.js';

let db: SqlJsDatabase | null = null;
let dbPath = '';
let initPromise: Promise<SqlJsDatabase> | null = null;

export async function getDatabase(): Promise<SqlJsDatabase> {
  if (db) return db;
  if (!initPromise) {
    initPromise = (async () => {
      const wasmPath = app.isPackaged
        ? path.join(process.resourcesPath, 'sql-wasm.wasm')
        : path.join(__dirname, '../../../../node_modules/sql.js/dist/sql-wasm.wasm');
      const SQL = await initSqlJs({ locateFile: () => wasmPath });
      dbPath = path.join(app.getPath('userData'), 'pos-database.db');

      if (fs.existsSync(dbPath)) {
        const fileBuffer = fs.readFileSync(dbPath);
        db = new SQL.Database(fileBuffer);
      } else {
        db = new SQL.Database();
      }

      db.run('PRAGMA foreign_keys = ON');
      initializeDatabase(db);
      seedDefaultData(db);
      saveDatabase();
      return db;
    })();
  }
  return initPromise;
}

export function saveDatabase(): void {
  if (!db || !dbPath) return;
  const data = db.export();
  const buffer = Buffer.from(data);
  const tempPath = `${dbPath}.tmp`;
  fs.writeFileSync(tempPath, buffer);
  fs.renameSync(tempPath, dbPath);
}

export function closeDatabase(): void {
  if (db) {
    saveDatabase();
    db.close();
    db = null;
    initPromise = null;
  }
}
