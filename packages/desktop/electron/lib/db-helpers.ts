import type { Database as SqlJsDatabase } from 'sql.js';

export function queryAll(db: SqlJsDatabase, sql: string, params: unknown[] = []): Record<string, unknown>[] {
  const stmt = db.prepare(sql);
  stmt.bind(params);
  const results: Record<string, unknown>[] = [];
  while (stmt.step()) {
    results.push(stmt.getAsObject());
  }
  stmt.free();
  return results;
}

export function queryOne(db: SqlJsDatabase, sql: string, params: unknown[] = []): Record<string, unknown> | null {
  const results = queryAll(db, sql, params);
  return results[0] || null;
}

export function runTransaction(db: SqlJsDatabase, fn: () => void): void {
  db.run('BEGIN');
  try {
    fn();
    db.run('COMMIT');
  } catch (error) {
    db.run('ROLLBACK');
    throw error;
  }
}

export function parseLimit(limit: unknown, defaultLimit = 100): number {
  const n = typeof limit === 'number' ? limit : parseInt(String(limit), 10);
  if (!Number.isFinite(n) || n < 1) return defaultLimit;
  return Math.min(n, 1000);
}

export function assertPositiveInt(value: unknown, field: string): number {
  const n = typeof value === 'number' ? value : parseInt(String(value), 10);
  if (!Number.isFinite(n) || n <= 0) throw new Error(`Invalid ${field}: must be a positive integer`);
  return n;
}

export function assertNonNegativeNumber(value: unknown, field: string): number {
  const n = typeof value === 'number' ? value : parseFloat(String(value));
  if (!Number.isFinite(n) || n < 0) throw new Error(`Invalid ${field}: must be non-negative`);
  return n;
}
