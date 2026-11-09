// IndexedDB owned by the background. YOLO schema: bump DB_VERSION to wipe and recreate.
const DB_NAME = 'ytenrich';
const DB_VERSION = 1;
export const VIDEOS = 'videos';
export const DAYS = 'days';

let dbPromise: Promise<IDBDatabase> | undefined;

export function openDb(): Promise<IDBDatabase> {
  dbPromise ??= new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      for (const name of [...db.objectStoreNames]) db.deleteObjectStore(name);
      const videos = db.createObjectStore(VIDEOS, { keyPath: 'id' });
      videos.createIndex('seen', 'seen');
      videos.createIndex('lastSeen', 'lastSeen');
      db.createObjectStore(DAYS, { keyPath: 'day' });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
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
