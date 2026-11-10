// IndexedDB owned by the background. Upgrades are additive: missing stores and indexes are created, and
// derived stores are rebuilt from `videos`. Readers tolerate rows that lack newer fields (stats-rules `normDay`).
import { addChannel } from '../shared/stats-rules.ts';
import type { ChannelStat, VideoStat } from '../shared/types.ts';

const DB_NAME = 'ytenrich';
const DB_VERSION = 2;
export const VIDEOS = 'videos';
export const DAYS = 'days';
export const CHANNELS = 'channels';

const SCHEMA: Record<string, { keyPath: string; indexes: readonly string[] }> = {
  [VIDEOS]: { keyPath: 'id', indexes: ['seen', 'opened', 'lastSeen', 'openedAt', 'channel'] },
  [DAYS]: { keyPath: 'day', indexes: [] },
  [CHANNELS]: { keyPath: 'name', indexes: ['seen', 'opened', 'lastSeen'] },
};

let dbPromise: Promise<IDBDatabase> | undefined;

export function openDb(): Promise<IDBDatabase> {
  dbPromise ??= new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      const tx = req.transaction as IDBTransaction;
      const fresh = !db.objectStoreNames.contains(CHANNELS);
      for (const [name, def] of Object.entries(SCHEMA)) {
        const store = db.objectStoreNames.contains(name)
          ? tx.objectStore(name)
          : db.createObjectStore(name, { keyPath: def.keyPath });
        for (const i of def.indexes) if (!store.indexNames.contains(i)) store.createIndex(i, i);
      }
      if (fresh) backfill(tx);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

/** Runs once, inside the upgrade transaction: derives channel counters from the stored videos and gives
 * opened rows an `openedAt` (their last impression is the best guess), so History starts populated. */
function backfill(tx: IDBTransaction): void {
  const acc = new Map<string, ChannelStat>(); // bound: distinct channels among ≤ MAX_VIDEOS rows, upgrade only
  void walk(tx.objectStore(VIDEOS), null, 'next', (c) => {
    const v = c.value as VideoStat;
    if (v.openedAt === undefined) c.update({ ...v, openedAt: v.opened ? v.lastSeen : 0 });
    if (v.channel) {
      const delta = { seen: v.seen, videos: 1, opened: v.opened, dismissed: v.dismissedAt ? 1 : 0 };
      const next = addChannel(acc.get(v.channel), v.channel, v.lastSeen, delta);
      acc.set(v.channel, { ...next, lastSeen: Math.max(next.lastSeen, v.lastSeen) });
    }
    return true;
  }).then(() => {
    const store = tx.objectStore(CHANNELS);
    for (const c of acc.values()) store.put(c);
  });
}

export function done<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export function complete(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = tx.onabort = () => reject(tx.error);
  });
}

/** Iterate a cursor; `visit` returns false to stop. */
export function walk(
  source: IDBObjectStore | IDBIndex,
  range: IDBKeyRange | null,
  dir: IDBCursorDirection,
  visit: (cursor: IDBCursorWithValue) => boolean,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const req = source.openCursor(range, dir);
    req.onerror = () => reject(req.error);
    req.onsuccess = () => {
      const cursor = req.result;
      if (!cursor || !visit(cursor)) return resolve();
      cursor.continue();
    };
  });
}
