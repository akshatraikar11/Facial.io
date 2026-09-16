/**
 * Facial.io Service Worker — Offline Check-in Queue
 *
 * Intercepts POST /api/attendance/check-in requests.
 * If the request fails due to network error, stores the payload in
 * IndexedDB and responds with a synthetic "queued" response so the
 * kiosk UI knows the check-in was saved locally.
 *
 * On the 'sync' event (Background Sync API, Chrome/Android) the stored
 * items are replayed. The React hook (useOfflineQueue) handles the same
 * logic for browsers that don't support Background Sync.
 *
 * All other requests pass through with no interception.
 */

const QUEUE_DB_NAME    = 'facialio_sw_queue';
const QUEUE_STORE_NAME = 'checkins';
const DB_VERSION       = 1;
const CHECK_IN_PATH    = '/api/attendance/check-in';

// ── IndexedDB helpers (no Dexie in SW — raw IDB) ─────────────────────────

const openDB = () =>
  new Promise((resolve, reject) => {
    const req = indexedDB.open(QUEUE_DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      e.target.result.createObjectStore(QUEUE_STORE_NAME, {
        keyPath: 'id', autoIncrement: true,
      });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror   = () => reject(req.error);
  });

const saveToQueue = async (payload) => {
  const db    = await openDB();
  const tx    = db.transaction(QUEUE_STORE_NAME, 'readwrite');
  const store = tx.objectStore(QUEUE_STORE_NAME);
  store.add({ ...payload, queuedAt: Date.now() });
  return new Promise((res, rej) => {
    tx.oncomplete = res;
    tx.onerror    = rej;
  });
};

const getAllQueued = async () => {
  const db    = await openDB();
  const tx    = db.transaction(QUEUE_STORE_NAME, 'readonly');
  const store = tx.objectStore(QUEUE_STORE_NAME);
  return new Promise((res) => {
    const req = store.getAll();
    req.onsuccess = () => res(req.result);
    req.onerror   = () => res([]);
  });
};

const removeFromQueue = async (id) => {
  const db    = await openDB();
  const tx    = db.transaction(QUEUE_STORE_NAME, 'readwrite');
  tx.objectStore(QUEUE_STORE_NAME).delete(id);
};

// ── Fetch intercept ───────────────────────────────────────────────────────

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Only intercept check-in POSTs
  if (event.request.method !== 'POST' || !url.pathname.endsWith(CHECK_IN_PATH)) return;

  event.respondWith(
    fetch(event.request.clone()).catch(async () => {
      // Network failed — queue the payload
      try {
        const body = await event.request.json();
        await saveToQueue(body);

        // Register background sync if available
        if ('sync' in self.registration) {
          await self.registration.sync.register('checkin-sync');
        }
      } catch {
        // Could not read body — ignore
      }

      // Return synthetic response so kiosk knows it was queued
      return new Response(
        JSON.stringify({
          status:  'queued',
          message: 'Check-in saved offline. Will sync when connection restores.',
        }),
        {
          status:  202,
          headers: { 'Content-Type': 'application/json' },
        },
      );
    }),
  );
});

// ── Background Sync ───────────────────────────────────────────────────────

self.addEventListener('sync', (event) => {
  if (event.tag === 'checkin-sync') {
    event.waitUntil(replayQueue());
  }
});

const replayQueue = async () => {
  const items = await getAllQueued();
  for (const item of items) {
    try {
      const res = await fetch('/api/attendance/check-in', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ ...item, offlineQueued: true }),
      });
      if (res.ok) await removeFromQueue(item.id);
    } catch {
      // Still offline — leave in queue, will retry next sync event
    }
  }
};

// ── Activate: take control immediately ───────────────────────────────────

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});
