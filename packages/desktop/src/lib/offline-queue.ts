export interface OfflineOperation<TPayload> {
  id: string;
  type: string;
  payload: TPayload;
  createdAt: string;
  attempts: number;
}

const STORAGE_KEY = "pos:offline-operations";

function readQueue<TPayload>(): OfflineOperation<TPayload>[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as OfflineOperation<TPayload>[]) : [];
  } catch {
    return [];
  }
}

function writeQueue<TPayload>(queue: OfflineOperation<TPayload>[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(queue));
}

export function enqueueOfflineOperation<TPayload>(
  type: string,
  payload: TPayload,
): OfflineOperation<TPayload> {
  const operation: OfflineOperation<TPayload> = {
    id: crypto.randomUUID(),
    type,
    payload,
    createdAt: new Date().toISOString(),
    attempts: 0,
  };
  writeQueue([...readQueue<TPayload>(), operation]);
  return operation;
}

export function getOfflineOperations<TPayload>(): OfflineOperation<TPayload>[] {
  return readQueue<TPayload>();
}

export function removeOfflineOperation(id: string): void {
  writeQueue(readQueue<unknown>().filter((operation) => operation.id !== id));
}

export function markOfflineOperationAttempted(id: string): void {
  const queue = readQueue<unknown>().map((operation) =>
    operation.id === id
      ? { ...operation, attempts: operation.attempts + 1 }
      : operation,
  );
  writeQueue(queue);
}
