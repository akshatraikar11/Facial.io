/**
 * useOfflineQueue — monitors network state and drains the offline check-in queue.
 *
 * How it works:
 *   1. Listens to navigator.onLine + window online/offline events
 *   2. When connection restores, fetches all pending items from IndexedDB
 *   3. Replays each item against POST /api/attendance/check-in
 *   4. Deletes successfully synced items, increments retry count on failure
 *   5. Returns { pending, isSyncing, isOnline } for the kiosk UI to display
 *
 * The hook is safe to mount multiple times — the sync lock (syncingRef)
 * prevents concurrent replay runs.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { api } from '../../services/api';
import {
  getQueue, dequeue, markRetry, queueCount,
  type QueuedCheckIn,
} from '../../utils/offlineQueue';

interface OfflineQueueState {
  pending: number;        // items waiting to sync
  isSyncing: boolean;     // currently replaying the queue
  isOnline: boolean;      // current network status
  lastSyncAt: Date | null; // when we last successfully drained the queue
}

export const useOfflineQueue = (): OfflineQueueState => {
  const [state, setState] = useState<OfflineQueueState>({
    pending: 0,
    isSyncing: false,
    isOnline: navigator.onLine,
    lastSyncAt: null,
  });

  const syncingRef = useRef(false); // prevent concurrent syncs

  const refreshCount = useCallback(async () => {
    const count = await queueCount();
    setState(s => ({ ...s, pending: count }));
  }, []);

  const syncQueue = useCallback(async () => {
    if (syncingRef.current || !navigator.onLine) return;
    const items = await getQueue();
    if (!items.length) return;

    syncingRef.current = true;
    setState(s => ({ ...s, isSyncing: true }));

    for (const item of items) {
      try {
        await api.post('/attendance/check-in', {
          orgId:      item.orgId,
          employeeId: item.employeeId,
          name:       item.name,
          // flag so the server knows this is a queued replay, not a live check-in
          offlineQueued: true,
          queuedAt:   new Date(item.queuedAt).toISOString(),
        });
        await dequeue(item.id!);
      } catch {
        await markRetry(item.id!);
      }
    }

    syncingRef.current = false;
    const remaining = await queueCount();
    setState(s => ({
      ...s,
      isSyncing: false,
      pending: remaining,
      lastSyncAt: remaining === 0 ? new Date() : s.lastSyncAt,
    }));
  }, []);

  // ── Network event listeners ───────────────────────────────────────────────
  useEffect(() => {
    const handleOnline = () => {
      setState(s => ({ ...s, isOnline: true }));
      syncQueue();
    };

    const handleOffline = () => {
      setState(s => ({ ...s, isOnline: false }));
    };

    window.addEventListener('online',  handleOnline);
    window.addEventListener('offline', handleOffline);

    // Initial count on mount
    refreshCount();

    // Also try to sync on mount in case we came back online between sessions
    if (navigator.onLine) syncQueue();

    return () => {
      window.removeEventListener('online',  handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [syncQueue, refreshCount]);

  return state;
};
