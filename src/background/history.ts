// Open events are bounded independently of video counters: oldest events yield first at 200k.
import type { HistoryPage, HistoryQuery, OpenEvent, OpenRow, VideoStat } from '../shared/types.ts';
import { done, OPENS, openDb, VIDEOS, walk } from './db.ts';

export const MAX_OPENS = 200_000;
const videoRange = (id: string): IDBKeyRange => IDBKeyRange.bound([id], [id, []]);

export async function capOpens(tx: IDBTransaction, cap = MAX_OPENS): Promise<void> {
  const store = tx.objectStore(OPENS);
  let excess = (await done(store.count())) - cap;
  if (excess > 0)
    await walk(store.index('time'), null, 'next', (c) => {
      c.delete();
      return --excess > 0;
    });
}

/** Queue deletions in the same transaction that deletes the video. */
export function removeOpens(tx: IDBTransaction, id: string): void {
  void walk(tx.objectStore(OPENS).index('video'), videoRange(id), 'next', (c) => {
    c.delete();
    return true;
  });
}

export async function history(q: HistoryQuery): Promise<HistoryPage> {
  const tx = (await openDb()).transaction([OPENS, VIDEOS]);
  const videos = tx.objectStore(VIDEOS);
  const limit = Math.max(1, Math.min(1000, q.limit));
  const needle = q.search.trim().toLowerCase();
  const rows: OpenRow[] = []; // bound: page limit + one lookahead
  const range = q.before ? IDBKeyRange.upperBound(q.before, true) : null;
  // Keep each join inside the cursor callback so its transaction stays active across browsers.
  await new Promise<void>((resolve, reject) => {
    const req = tx.objectStore(OPENS).index('time').openCursor(range, 'prev');
    req.onerror = () => reject(req.error);
    req.onsuccess = () => {
      const c = req.result;
      if (!c) return resolve();
      const event = c.value as OpenEvent;
      const get = videos.get(event.video);
      get.onerror = () => reject(get.error);
      get.onsuccess = () => {
        const row = get.result as VideoStat | undefined;
        if (
          row &&
          (!needle || `${row.title} ${row.channel} ${row.id}`.toLowerCase().includes(needle))
        )
          rows.push({ ...event, row });
        if (rows.length > limit) resolve();
        else c.continue();
      };
    };
  });
  const more = rows.length > limit;
  rows.length = Math.min(rows.length, limit);
  const last = rows.at(-1);
  return { rows, next: more && last ? [last.time, last.id] : null };
}

export async function videoOpens(id: string): Promise<OpenEvent[]> {
  const rows: OpenEvent[] = []; // bound: MAX_OPENS, through the video index only
  const source = (await openDb()).transaction(OPENS).objectStore(OPENS).index('video');
  await walk(source, videoRange(id), 'prev', (c) => rows.push(c.value as OpenEvent) < MAX_OPENS);
  return rows;
}
