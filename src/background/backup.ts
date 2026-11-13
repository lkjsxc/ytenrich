// Backup of the stats DB: paged reads of whole stores, and writes of rows repaired to the current shape.
import { emptyDay, emptyStat, isCountName, normDay } from '../shared/stats-rules.ts';
import type { ChannelStat, StoreName } from '../shared/types.ts';
import { complete, openDb, walk } from './db.ts';
import { forget, prune } from './stats-repo.ts';

const KEY: Record<StoreName, string> = { videos: 'id', days: 'day', channels: 'name' };
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
  const tx = (await openDb()).transaction(store, 'readwrite');
  const target = tx.objectStore(store);
  for (const row of rows) {
    if (typeof row !== 'object' || row === null) continue;
    const raw = row as Record<string, unknown>;
    const key = raw[KEY[store]];
    if (typeof key !== 'string' || !key) continue;
    if (store === 'videos') {
      const v = repair(emptyStat(key, 0), raw);
      target.put(isCountName(v.channel) ? { ...v, channel: '' } : v); // a backup from before 0.2.9 (db.ts `scrub`)
    } else if (store === 'days') target.put(normDay(repair(emptyDay(key), raw)));
    else if (!isCountName(key)) target.put(repair({ ...CHANNEL, name: key }, raw));
  }
  await complete(tx);
  forget();
  void prune(); // a backup never grows the DB past its caps
}
