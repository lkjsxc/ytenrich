// Recommended view query: the newest still-unopened recommendations, ranked by the user's own record.
import { rankByChannel, rankVideos } from '../shared/recommend.ts';
import { learn } from '../shared/taste.ts';
import type { ChannelStat, RecoMode, RecoPage, VideoStat } from '../shared/types.ts';
import { CHANNELS, done, openDb, VIDEOS, walk } from './db.ts';
import type { Judge } from './suppress.ts';

const POOL = 2000; // newest candidates considered per query
const STOCK = 1500; // fresh candidates worth holding; below it, pages are asked to collect more
const FRESH_MS = 72 * 3600_000;

const TASTE_TITLES = 400; // titles per class the taste model learns from

export async function recommend(mode: RecoMode, limit: number, sup: Judge): Promise<RecoPage> {
  const tx = (await openDb()).transaction([VIDEOS, CHANNELS]);
  const videos = tx.objectStore(VIDEOS);
  const pool: VideoStat[] = []; // bound: POOL
  const dismissed: string[] = []; // bound: TASTE_TITLES
  await walk(videos.index('lastSeen'), null, 'prev', (c) => {
    const s = c.value as VideoStat;
    const kind = mode === 'channel' || s.kind === mode;
    if (s.dismissedAt && dismissed.length < TASTE_TITLES) dismissed.push(s.title);
    if (kind && !s.opened && !s.dismissedAt && !sup(s)) pool.push(s);
    return pool.length < POOL;
  });
  const opened: string[] = []; // bound: TASTE_TITLES
  await walk(videos.index('openedAt'), IDBKeyRange.lowerBound(1), 'prev', (c) => {
    return opened.push((c.value as VideoStat).title) < TASTE_TITLES;
  });
  // Passed over: on screen at least twice and still unopened.
  const ignored = pool.filter((v) => v.seen > 1).map((v) => v.title);
  const taste = learn(opened, ignored.slice(0, TASTE_TITLES), dismissed);
  const names = [...new Set(pool.map((v) => v.channel).filter(Boolean))];
  const store = tx.objectStore(CHANNELS);
  const stats = await Promise.all(names.map((n) => done<ChannelStat | undefined>(store.get(n))));
  const channels = new Map(stats.flatMap((c) => (c ? [[c.name, c] as const] : []))); // bound: ≤ POOL
  const rank = mode === 'channel' ? rankByChannel : rankVideos;
  const ranked = rank(pool, channels, Date.now(), taste);
  const rows = ranked.slice(0, limit);
  const shown = new Set(rows.map((v) => v.channel));
  return {
    rows,
    more: ranked.length > limit,
    suppressed: [],
    channels: mode === 'channel' ? [...channels.values()].filter((c) => shown.has(c.name)) : [],
  };
}

/** Whether the stock of fresh candidates is low, so pages may load more of YouTube's lists. */
export async function wanted(sup: Judge): Promise<boolean> {
  const index = (await openDb()).transaction(VIDEOS).objectStore(VIDEOS).index('lastSeen');
  let fresh = 0;
  await walk(index, IDBKeyRange.lowerBound(Date.now() - FRESH_MS), 'prev', (c) => {
    const s = c.value as VideoStat;
    if (!s.opened && !s.dismissedAt && !sup(s)) fresh++;
    return fresh < STOCK;
  });
  return fresh < STOCK;
}
