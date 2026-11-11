// Stats writes. Every mutation updates the video row, the day row and the channel row in one transaction.
import {
  addChannel,
  addDay,
  applyImpression,
  applyOffer,
  emptyStat,
  isPrunable,
  isSuppressed,
  MAX_CHANNELS,
  MAX_VIDEOS,
  PRUNE_AGE_MS,
} from '../shared/stats-rules.ts';
import type {
  ChannelDelta,
  ChannelStat,
  DayDelta,
  DayStat,
  Impression,
  Surface,
  VideoStat,
} from '../shared/types.ts';
import { dayKey } from '../shared/types.ts';
import { CHANNELS, complete, DAYS, done, openDb, VIDEOS, walk } from './db.ts';

const ALL = [VIDEOS, DAYS, CHANNELS];

/** Suppressed ids for one threshold, loaded once per worker lifetime and then kept current by `track`. */
let cache: { threshold: number; ids: Set<string> } | undefined; // bound: ≤ MAX_VIDEOS ids

export async function suppressedIds(threshold: number): Promise<ReadonlySet<string>> {
  if (cache?.threshold === threshold) return cache.ids;
  const ids = new Set<string>();
  const index = (await openDb()).transaction(VIDEOS).objectStore(VIDEOS).index('seen');
  await walk(index, IDBKeyRange.lowerBound(threshold), 'next', (c) => {
    if (isSuppressed(c.value as VideoStat, threshold)) ids.add((c.value as VideoStat).id);
    return true;
  });
  cache = { threshold, ids };
  return ids;
}

function track(s: VideoStat): void {
  if (!cache) return;
  if (isSuppressed(s, cache.threshold)) cache.ids.add(s.id);
  else cache.ids.delete(s.id);
}

async function putDay(tx: IDBTransaction, now: number, delta: DayDelta): Promise<void> {
  const days = tx.objectStore(DAYS);
  days.put(addDay(await done<DayStat | undefined>(days.get(dayKey(now))), now, delta));
}

async function putChannel(
  tx: IDBTransaction,
  name: string,
  now: number,
  delta: ChannelDelta,
): Promise<void> {
  if (!name) return;
  const store = tx.objectStore(CHANNELS);
  store.put(addChannel(await done<ChannelStat | undefined>(store.get(name)), name, now, delta));
}

/** Records impressions; returns the ids among them that are now suppressed. */
export async function record(
  items: readonly Impression[],
  hidden: number,
  threshold: number,
): Promise<string[]> {
  const tx = (await openDb()).transaction(ALL, 'readwrite');
  const videos = tx.objectStore(VIDEOS);
  const now = Date.now();
  const suppressed: string[] = [];
  const day = { seen: items.length, fresh: 0, shorts: 0, hidden };
  const surfaces: Partial<Record<Surface, number>> = {};
  const channels = new Map<string, { seen: number; videos: number }>(); // bound: one per batch channel
  for (const item of items) {
    const prev = await done<VideoStat | undefined>(videos.get(item.id));
    const next = applyImpression(prev, item, now);
    videos.put(next);
    track(next);
    if (isSuppressed(next, threshold)) suppressed.push(next.id);
    const first = !prev || prev.seen === 0;
    if (first) day.fresh++;
    if (item.kind === 'short') day.shorts++;
    surfaces[item.surface] = (surfaces[item.surface] ?? 0) + 1;
    const c = channels.get(next.channel) ?? { seen: 0, videos: 0 };
    channels.set(next.channel, { seen: c.seen + 1, videos: c.videos + (first ? 1 : 0) });
  }
  await putDay(tx, now, { ...day, surfaces });
  for (const [name, delta] of channels) await putChannel(tx, name, now, delta);
  await complete(tx);
  return suppressed;
}

/** Keeps recommendations that were on a page without being on screen (video rows only, no counters). */
export async function offer(items: readonly Impression[]): Promise<void> {
  const tx = (await openDb()).transaction(VIDEOS, 'readwrite');
  const videos = tx.objectStore(VIDEOS);
  const now = Date.now();
  for (const item of items)
    videos.put(applyOffer(await done<VideoStat | undefined>(videos.get(item.id)), item, now));
  await complete(tx);
}

async function edit(
  id: string,
  fn: (s: VideoStat) => VideoStat,
  deltas?: (prev: VideoStat | undefined) => { day: DayDelta; channel: ChannelDelta },
): Promise<void> {
  const tx = (await openDb()).transaction(ALL, 'readwrite');
  const videos = tx.objectStore(VIDEOS);
  const now = Date.now();
  const prev = await done<VideoStat | undefined>(videos.get(id));
  const next = fn(prev ?? emptyStat(id, now));
  videos.put(next);
  track(next);
  const d = deltas?.(prev);
  if (d) {
    await putDay(tx, now, d.day);
    await putChannel(tx, next.channel, now, d.channel);
  }
  await complete(tx);
}

export function opened(req: Pick<VideoStat, 'id' | 'kind' | 'title' | 'channel'>): Promise<void> {
  return edit(
    req.id,
    (s) => ({
      ...s,
      kind: req.kind,
      title: req.title || s.title,
      channel: req.channel || s.channel,
      opened: s.opened + 1,
      openedAt: Date.now(),
    }),
    (prev) => ({ day: { opened: 1, picked: prev?.seen ? 1 : 0 }, channel: { opened: 1 } }),
  );
}

export function describe(id: string, title: string): Promise<void> {
  return edit(id, (s) => (s.title ? s : { ...s, title }));
}

export function dismissed(id: string): Promise<void> {
  return edit(
    id,
    (s) => ({ ...s, dismissedAt: Date.now() }),
    (prev) => {
      const n = prev?.dismissedAt ? 0 : 1;
      return { day: { dismissed: n }, channel: { dismissed: n } };
    },
  );
}

export function allow(id: string, allowed: boolean): Promise<void> {
  return edit(id, (s) => ({ ...s, allowed }));
}

/** After rows were written behind this module's back (a restored backup). */
export const forget = (): void => void (cache = undefined);

export async function clear(): Promise<void> {
  const tx = (await openDb()).transaction(ALL, 'readwrite');
  for (const name of ALL) tx.objectStore(name).clear();
  await complete(tx);
  cache = undefined;
}

/** Drops stale unopened rows, then the oldest rows beyond the caps. */
export async function prune(): Promise<number> {
  const tx = (await openDb()).transaction([VIDEOS, CHANNELS], 'readwrite');
  const now = Date.now();
  let removed = 0;
  const videos = tx.objectStore(VIDEOS);
  let excess = (await done(videos.count())) - MAX_VIDEOS;
  await walk(videos.index('lastSeen'), null, 'next', (c) => {
    const s = c.value as VideoStat;
    if (excess > 0 || isPrunable(s, now)) {
      c.delete();
      cache?.ids.delete(s.id);
      excess--;
      removed++;
      return true;
    }
    return now - s.lastSeen > PRUNE_AGE_MS;
  });
  const channels = tx.objectStore(CHANNELS);
  let extra = (await done(channels.count())) - MAX_CHANNELS;
  if (extra > 0)
    await walk(channels.index('lastSeen'), null, 'next', (c) => {
      c.delete();
      return --extra > 0;
    });
  await complete(tx);
  return removed;
}
