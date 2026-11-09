import {
  applyImpression,
  bumpDay,
  emptyStat,
  isPrunable,
  isSuppressed,
  MAX_VIDEOS,
  PRUNE_AGE_MS,
} from '../shared/stats-rules.ts';
import {
  type DayStat,
  dayKey,
  type Impression,
  type StatsQuery,
  type Summary,
  type VideoStat,
} from '../shared/types.ts';
import { complete, DAYS, done, openDb, VIDEOS, walk } from './db.ts';

export async function record(items: readonly Impression[], threshold: number): Promise<string[]> {
  const db = await openDb();
  const tx = db.transaction([VIDEOS, DAYS], 'readwrite');
  const videos = tx.objectStore(VIDEOS);
  const days = tx.objectStore(DAYS);
  const now = Date.now();
  const suppressed: string[] = [];
  for (const item of items) {
    const next = applyImpression(await done<VideoStat | undefined>(videos.get(item.id)), item, now);
    videos.put(next);
    if (isSuppressed(next, threshold)) suppressed.push(next.id);
  }
  const day = await done<DayStat | undefined>(days.get(dayKey(now)));
  days.put(bumpDay(day, now, 'seen', items.length));
  await complete(tx);
  return suppressed;
}

export async function mutate(
  id: string,
  fn: (s: VideoStat) => VideoStat,
  dayField?: 'opened' | 'dismissed',
): Promise<void> {
  const db = await openDb();
  const tx = db.transaction([VIDEOS, DAYS], 'readwrite');
  const videos = tx.objectStore(VIDEOS);
  const now = Date.now();
  videos.put(fn((await done<VideoStat | undefined>(videos.get(id))) ?? emptyStat(id, now)));
  if (dayField) {
    const days = tx.objectStore(DAYS);
    days.put(bumpDay(await done<DayStat | undefined>(days.get(dayKey(now))), now, dayField));
  }
  await complete(tx);
}

export async function suppressedIds(threshold: number): Promise<string[]> {
  const db = await openDb();
  const index = db.transaction(VIDEOS).objectStore(VIDEOS).index('seen');
  const ids: string[] = [];
  await walk(index, IDBKeyRange.lowerBound(threshold), 'next', (c) => {
    if (isSuppressed(c.value as VideoStat, threshold)) ids.push((c.value as VideoStat).id);
    return true;
  });
  return ids;
}

export async function counts(ids: readonly string[]): Promise<Record<string, number>> {
  const store = (await openDb()).transaction(VIDEOS).objectStore(VIDEOS);
  const out: Record<string, number> = {};
  const rows = await Promise.all(ids.map((id) => done<VideoStat | undefined>(store.get(id))));
  for (const row of rows) if (row) out[row.id] = row.seen;
  return out;
}

const FILTERS: Record<StatsQuery['filter'], (s: VideoStat, t: number) => boolean> = {
  all: () => true,
  unopened: (s) => s.opened === 0,
  opened: (s) => s.opened > 0,
  suppressed: (s, t) => isSuppressed(s, t),
  dismissed: (s) => s.dismissedAt > 0,
};

export async function query(q: StatsQuery, threshold: number): Promise<VideoStat[]> {
  const index = (await openDb()).transaction(VIDEOS).objectStore(VIDEOS).index(q.sort);
  const needle = q.search.trim().toLowerCase();
  const rows: VideoStat[] = [];
  await walk(index, null, 'prev', (c) => {
    const s = c.value as VideoStat;
    const text = needle ? `${s.title} ${s.channel} ${s.id}`.toLowerCase().includes(needle) : true;
    if (text && FILTERS[q.filter](s, threshold)) rows.push(s);
    return rows.length < q.limit;
  });
  return rows;
}

export async function summary(threshold: number): Promise<Summary> {
  const db = await openDb();
  const tx = db.transaction([VIDEOS, DAYS]);
  const videos = await done(tx.objectStore(VIDEOS).count());
  const days: DayStat[] = [];
  await walk(tx.objectStore(DAYS), null, 'prev', (c) => days.push(c.value as DayStat) < 30);
  return { videos, suppressed: (await suppressedIds(threshold)).length, days };
}

export async function clear(): Promise<void> {
  const tx = (await openDb()).transaction([VIDEOS, DAYS], 'readwrite');
  tx.objectStore(VIDEOS).clear();
  tx.objectStore(DAYS).clear();
  await complete(tx);
}

export async function prune(): Promise<number> {
  const tx = (await openDb()).transaction(VIDEOS, 'readwrite');
  const store = tx.objectStore(VIDEOS);
  const now = Date.now();
  let excess = (await done(store.count())) - MAX_VIDEOS;
  let removed = 0;
  await walk(store.index('lastSeen'), null, 'next', (c) => {
    const s = c.value as VideoStat;
    if (excess > 0 || isPrunable(s, now)) {
      c.delete();
      excess--;
      removed++;
      return true;
    }
    return excess > 0 || now - s.lastSeen > PRUNE_AGE_MS;
  });
  await complete(tx);
  return removed;
}
