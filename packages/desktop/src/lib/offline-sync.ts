import {
  getOfflineOperations,
  markOfflineOperationAttempted,
  removeOfflineOperation,
  type OfflineOperation,
} from "./offline-queue";

export interface OfflineSyncAdapter<TPayload> {
  execute: (operation: OfflineOperation<TPayload>) => Promise<void>;
}

export async function synchronizeOfflineOperations<TPayload>(
  adapter: OfflineSyncAdapter<TPayload>,
): Promise<{ synced: number; failed: number }> {
  const operations = getOfflineOperations<TPayload>();
  let synced = 0;
  let failed = 0;

  for (const operation of operations) {
    try {
      await adapter.execute(operation);
      removeOfflineOperation(operation.id);
      synced += 1;
    } catch {
      markOfflineOperationAttempted(operation.id);
      failed += 1;
    }
  }

  return { synced, failed };
}
