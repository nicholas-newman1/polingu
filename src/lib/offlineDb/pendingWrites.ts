import type { Table } from 'dexie';

/**
 * userData key prefix marking a review collection reset done offline that still
 * has to reach the server (see createReviewSubcollectionStorage's clearAllCards).
 */
export const PENDING_CLEAR_KEY_PREFIX = '__pendingClear:';

interface PendingRow {
  lastModified: number;
  data: unknown;
  pendingSync: number;
}

/** The parts of a cached row an upload was made from. */
export interface WrittenRow {
  lastModified: number;
  data: unknown;
}

function isUnchanged(row: PendingRow | undefined, written: WrittenRow): row is PendingRow {
  return (
    row !== undefined &&
    row.lastModified === written.lastModified &&
    JSON.stringify(row.data) === JSON.stringify(written.data)
  );
}

/**
 * Clears a cached row's pending flag once its upload succeeds, unless the row was
 * saved again while the upload was in flight. That newer save has not reached the
 * server, so it must stay pending for the next sync to pick up.
 */
export async function markSyncedIfUnchanged<T extends PendingRow>(
  table: Table<T, string>,
  key: string,
  written: WrittenRow
): Promise<boolean> {
  return table.db.transaction('rw', table, async () => {
    const row = await table.get(key);
    if (!isUnchanged(row, written)) return false;
    await table.update(key, { pendingSync: 0 } as never);
    return true;
  });
}

/** Removes a cached row once its queued delete reaches the server, unless it was saved again since. */
export async function removeIfUnchanged<T extends PendingRow>(
  table: Table<T, string>,
  key: string,
  written: WrittenRow
): Promise<void> {
  await table.db.transaction('rw', table, async () => {
    const row = await table.get(key);
    if (isUnchanged(row, written)) await table.delete(key);
  });
}
