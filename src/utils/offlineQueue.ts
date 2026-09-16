/**
 * Offline Check-in Queue — IndexedDB via Dexie
 *
 * When the kiosk fires POST /api/attendance/check-in and the request fails
 * due to network loss, the payload is stored here.
 *
 * On reconnect, useOfflineQueue drains this store by replaying each item
 * against the live API, then deleting it on success.
 *
 * Dexie is already in package.json (used by the legacy dashboard).
 * We reuse it here rather than adding another dependency.
 */

import Dexie, { type Table } from 'dexie';

export interface QueuedCheckIn {
  id?: number;           // auto-incremented primary key
  orgId: string;
  employeeId: string;
  name: string;
  queuedAt: number;      // Date.now() — so we can show "queued 3 min ago"
  retries: number;
  locationId?: string;   // optional — set when kiosk has ?location= param
}

class OfflineQueueDB extends Dexie {
  checkIns!: Table<QueuedCheckIn, number>;

  constructor() {
    super('facialio_offline_queue');
    this.version(1).stores({
      checkIns: '++id, orgId, queuedAt',
    });
  }
}

export const db = new OfflineQueueDB();

/** Add a failed check-in to the queue */
export const enqueue = async (item: Omit<QueuedCheckIn, 'id' | 'retries'>): Promise<void> => {
  await db.checkIns.add({ ...item, retries: 0 });
};

/** Get all pending items */
export const getQueue = (): Promise<QueuedCheckIn[]> =>
  db.checkIns.orderBy('queuedAt').toArray();

/** Remove a successfully synced item */
export const dequeue = (id: number): Promise<void> =>
  db.checkIns.delete(id);

/** Increment retry count — remove item if it has failed too many times */
export const markRetry = async (id: number, maxRetries = 5): Promise<void> => {
  const item = await db.checkIns.get(id);
  if (!item) return;
  if (item.retries >= maxRetries) {
    await db.checkIns.delete(id); // give up after 5 attempts
  } else {
    await db.checkIns.update(id, { retries: item.retries + 1 });
  }
};

/** Count of pending items */
export const queueCount = (): Promise<number> => db.checkIns.count();
