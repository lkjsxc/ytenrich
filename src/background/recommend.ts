// Recommended view query: the newest still-unopened recommendations, ranked by the user's own record.
import { rankByChannel, rankVideos } from '../shared/recommend.ts';
import { isSuppressed } from '../shared/stats-rules.ts';
import type { ChannelStat, RecoMode, RecoPage, VideoStat } from '../shared/types.ts';
import { CHANNELS, done, openDb, VIDEOS, walk } from './db.ts';

const POOL = 1000; // newest candidates considered per query
const STOCK = 400; // fresh candidates worth holding; below it, pages are asked to collect more
const FRESH_MS = 48 * 3600_000;

export async function recommend(
  mode: RecoMode,
  limit: number,
  threshold: number,
): Promise<RecoPage> {
  const tx = (await openDb()).transaction([VIDEOS, CHANNELS]);
  const pool: VideoStat[] = []; // bound: POOL
  await walk(tx.objectStore(VIDEOS).index('lastSeen'), null, 'prev', (c) => {
    const s = c.value as VideoStat;
    const kind = mode === 'channel' || s.kind === mode;
    if (kind && !s.opened && !s.dismissedAt && !isSuppressed(s, threshold)) pool.push(s);
    return pool.length < POOL;
  });
  const names = [...new Set(pool.map((v) => v.channel).filter(Boolean))];
  const store = tx.objectStore(CHANNELS);
  const stats = await Promise.all(names.map((n) => done<ChannelStat | undefined>(store.get(n))));
  const channels = new Map(stats.flatMap((c) => (c ? [[c.name, c] as const] : []))); // bound: ≤ POOL
  const ranked = (mode === 'channel' ? rankByChannel : rankVideos)(pool, channels, Date.now());
  const rows = ranked.slice(0, limit);
  const shown = new Set(rows.map((v) => v.channel));
  return {
    rows,
    more: ranked.length > limit,
    channels: mode === 'channel' ? [...channels.values()].filter((c) => shown.has(c.name)) : [],
  };
}

/** Whether the stock of fresh candidates is low, so pages may load more of YouTube's lists. */
export async function wanted(threshold: number): Promise<boolean> {
  const index = (await openDb()).transaction(VIDEOS).objectStore(VIDEOS).index('lastSeen');
  let fresh = 0;
  await walk(index, IDBKeyRange.lowerBound(Date.now() - FRESH_MS), 'prev', (c) => {
    const s = c.value as VideoStat;
    if (!s.opened && !s.dismissedAt && !isSuppressed(s, threshold)) fresh++;
    return fresh < STOCK;
  });
  return fresh < STOCK;
}
