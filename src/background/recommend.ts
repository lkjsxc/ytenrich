// Recommended view query: the newest recommendations a tab asks for, ranked by the user's own record.
import { groupByChannel, PER_CHANNEL, rankNewest, rankVideos } from '../shared/recommend.ts';
import { learn } from '../shared/taste.ts';
import type { ChannelStat, RecoPage, RecoQuery, VideoStat } from '../shared/types.ts';
import { CHANNELS, done, openDb, VIDEOS, walk } from './db.ts';
import type { Judge } from './suppress.ts';

const POOL = 2000; // newest candidates considered per query
const SCAN = 4000; // rows read for the taste model when a channel's own rows are the pool
const STOCK = 1500; // fresh candidates worth holding; below it, pages are asked to collect more
const FRESH_MS = 72 * 3600_000;

const TASTE_TITLES = 400; // titles per class the taste model learns from

type Ranking = { ranked: VideoStat[]; channels: Map<string, ChannelStat> };

async function rankAll(q: RecoQuery, sup: Judge): Promise<Ranking> {
  const tx = (await openDb()).transaction([VIDEOS, CHANNELS]);
  const videos = tx.objectStore(VIDEOS);
  // Opened ones only when asked; over-exposed and dismissed ones never; with a search, only rows that match it.
  const words = q.text.toLowerCase().split(/\s+/).filter(Boolean);
  const matches = (s: VideoStat): boolean => {
    const hay = `${s.title} ${s.channel}`.toLowerCase();
    return words.every((w) => hay.includes(w));
  };
  const fits = (s: VideoStat): boolean =>
    q.kinds.includes(s.kind) &&
    !s.dismissedAt &&
    (s.opened ? q.opened : !sup(s)) &&
    (!words.length || matches(s));
  let pool: VideoStat[] = []; // bound: POOL, or one channel's rows
  const dismissed: string[] = []; // bound: TASTE_TITLES
  const ignored: string[] = []; // bound: TASTE_TITLES; on screen at least twice and still unopened
  let scanned = 0;
  await walk(videos.index('lastSeen'), null, 'prev', (c) => {
    const s = c.value as VideoStat;
    if (s.dismissedAt && dismissed.length < TASTE_TITLES) dismissed.push(s.title);
    if (!s.opened && s.seen > 1 && ignored.length < TASTE_TITLES) ignored.push(s.title);
    if (!q.channel && fits(s)) pool.push(s);
    return q.channel ? ++scanned < SCAN : pool.length < POOL;
  });
  if (q.channel)
    pool = (await done<VideoStat[]>(videos.index('channel').getAll(q.channel))).filter(fits);
  const opened: string[] = []; // bound: TASTE_TITLES
  await walk(videos.index('openedAt'), IDBKeyRange.lowerBound(1), 'prev', (c) => {
    return opened.push((c.value as VideoStat).title) < TASTE_TITLES;
  });
  const taste = learn(opened, ignored, dismissed);
  const names = [...new Set(pool.map((v) => v.channel).filter(Boolean))];
  const store = tx.objectStore(CHANNELS);
  const stats = await Promise.all(names.map((n) => done<ChannelStat | undefined>(store.get(n))));
  const channels = new Map(stats.flatMap((c) => (c ? [[c.name, c] as const] : []))); // bound: ≤ POOL
  const ordered =
    q.order === 'newest'
      ? rankNewest(pool)
      : rankVideos(pool, channels, Date.now(), taste, !q.channel);
  const ranked = q.group ? groupByChannel(ordered, q.channel ? Infinity : PER_CHANNEL) : ordered;
  return { ranked, channels };
}

// The last rankings are kept until the record changes (or a minute passes, since freshness moves the order): a
// tab's refreshes then cost one slice. A list's next page goes on with the ranking it shows even when the record
// changed meanwhile (for up to KEEP_MS): its order holds, and scrolling never waits for a full re-rank.
// Bound: MEMO_MAX queries × POOL rows.
const MEMO_MS = 60_000;
const KEEP_MS = 15 * 60_000;
const MEMO_MAX = 8;
const memo = new Map<string, { at: number; rev: number; ranking: Ranking }>();
let rev = 0;
/** The record or the settings changed: rankings are stale. */
export const touch = (): void => void rev++;
/** A dismissed video leaves the rankings kept for next pages. */
export function forget(id: string): void {
  for (const { ranking } of memo.values())
    ranking.ranked = ranking.ranked.filter((v) => v.id !== id);
}

export async function recommend(
  q: RecoQuery,
  limit: number,
  sup: Judge,
  more = false,
): Promise<RecoPage> {
  const key = JSON.stringify(q);
  let hit = memo.get(key);
  const age = hit ? Date.now() - hit.at : Infinity;
  if (!hit || (more ? age > KEEP_MS : hit.rev !== rev || age > MEMO_MS)) {
    hit = { at: Date.now(), rev, ranking: await rankAll(q, sup) };
    memo.delete(key);
    memo.set(key, hit);
    for (const old of memo.keys()) if (memo.size > MEMO_MAX) memo.delete(old);
  }
  const { ranked, channels } = hit.ranking;
  const rows = ranked.slice(0, limit);
  const shown = new Set(rows.map((v) => v.channel));
  return {
    rows,
    more: ranked.length > limit,
    suppressed: [],
    channels: q.group ? [...channels.values()].filter((c) => shown.has(c.name)) : [],
  };
}

/** Whether the stock of fresh candidates is low, so pages may load more of YouTube's lists. */
const STOCK_MS = 20_000; // collectors ask every couple of seconds while loading; one count serves them all
let stock: { at: number; low: boolean } | undefined;
export async function wanted(sup: Judge): Promise<boolean> {
  if (stock && Date.now() - stock.at < STOCK_MS) return stock.low;
  const index = (await openDb()).transaction(VIDEOS).objectStore(VIDEOS).index('lastSeen');
  let fresh = 0;
  await walk(index, IDBKeyRange.lowerBound(Date.now() - FRESH_MS), 'prev', (c) => {
    const s = c.value as VideoStat;
    if (!s.opened && !s.dismissedAt && !sup(s)) fresh++;
    return fresh < STOCK;
  });
  stock = { at: Date.now(), low: fresh < STOCK };
  return stock.low;
}
