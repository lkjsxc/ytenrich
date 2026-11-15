// Backup of the stats DB: paged reads of whole stores, and writes of rows repaired to the current shape.
import { emptyDay, emptyStat, isCountName, normDay } from '../shared/stats-rules.ts';
import type { ChannelStat, StoreName } from '../shared/types.ts';
import { complete, done, openDb, VIDEOS, walk } from './db.ts';
import { STORES } from './origin.ts';
import { forget, prune } from './stats-repo.ts';

const KEY = Object.fromEntries(
  STORES.map((s) => [s, s.endsWith('days') ? 'day' : s.endsWith('channels') ? 'name' : 'id']),
) as Record<StoreName, string>;
const CHANNEL: ChannelStat = {
  name: '',
  seen: 0,
  videos: 0,
  opened: 0,
  dismissed: 0,
  lastSeen: 0,
  icon: '',
};

export async function dump(
  store: StoreName,
  after: string | null,
  limit: number,
): Promise<{ rows: unknown[]; next: string | null }> {
  const rows: unknown[] = []; // bound: `limit` rows per call
  const range = after === null ? null : IDBKeyRange.lowerBound(after, true);
  const source = (await openDb()).transaction(store).objectStore(store);
  await walk(source, range, 'next', (c) => rows.push(c.value) < limit);
  const last = rows.at(-1) as Record<string, string> | undefined;
  return { rows, next: rows.length < limit || !last ? null : (last[KEY[store]] ?? null) };
}

/** Keeps the fields of `raw` whose type matches the template; everything else comes from the template. */
function repair<T extends object>(template: T, raw: Record<string, unknown>): T {
  const out = { ...template } as Record<string, unknown>;
  for (const [k, v] of Object.entries(template)) {
    const same = typeof raw[k] === typeof v && Array.isArray(raw[k]) === Array.isArray(v);
    if (same && raw[k] !== null) out[k] = raw[k];
  }
  return out as T;
}

export async function restore(store: StoreName, rows: readonly unknown[]): Promise<void> {
  const music = store.startsWith('music-');
  const base = store.replace('music-', '');
  const videoStore = music ? 'music-videos' : VIDEOS;
  const origin = music ? 'music' : 'youtube';
  const tx = (await openDb()).transaction(
    base === 'opens' ? [store, videoStore] : store,
    'readwrite',
  );
  const target = tx.objectStore(store);
  for (const row of rows) {
    if (typeof row !== 'object' || row === null) continue;
    const raw = row as Record<string, unknown>;
    const key = raw[KEY[store]];
    if (typeof key !== 'string' || !key) continue;
    if (base === 'opens') {
      if (
        typeof raw.video !== 'string' ||
        typeof raw.time !== 'number' ||
        !Number.isFinite(raw.time) ||
        raw.time < 0
      )
        continue;
      if (await done(tx.objectStore(videoStore).get(raw.video)))
        target.put({ id: key, video: raw.video, time: raw.time, origin });
    } else if (base === 'videos') {
      const v = { ...repair(emptyStat(key, 0), raw), origin };
      // Only YouTube backups before 0.2.9 captured view counters as channels (db.ts `scrub`).
      target.put(!music && isCountName(v.channel) ? { ...v, channel: '' } : v);
    } else if (base === 'days') target.put({ ...normDay(repair(emptyDay(key), raw)), origin });
    else if (music || !isCountName(key))
      target.put({ ...repair({ ...CHANNEL, name: key }, raw), origin });
  }
  await complete(tx);
  forget();
  await prune(); // a backup never grows the DB past its caps
}
