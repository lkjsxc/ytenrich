// Over-exposure state of the background: which channels the user likes and which videos are suppressed now.
import { isSuppressed, LIKED_OPENS } from '../shared/stats-rules.ts';
import type { ChannelStat, VideoStat } from '../shared/types.ts';
import { CHANNELS, openDb, VIDEOS, walk } from './db.ts';

/** Whether a video is over-exposed now, given the user's liked channels. */
export type Judge = (s: VideoStat) => boolean;

/** Names of channels the user opens (LIKED_OPENS or more), loaded once per worker lifetime. */
let liked: Set<string> | undefined; // bound: ≤ MAX_CHANNELS names
async function likedChannels(): Promise<ReadonlySet<string>> {
  if (liked) return liked;
  const names = new Set<string>();
  const index = (await openDb()).transaction(CHANNELS).objectStore(CHANNELS).index('opened');
  await walk(index, IDBKeyRange.lowerBound(LIKED_OPENS), 'next', (c) => {
    names.add((c.value as ChannelStat).name);
    return true;
  });
  liked ??= names;
  return liked;
}

export async function judge(threshold: number): Promise<Judge> {
  const names = await likedChannels();
  return (s) => isSuppressed(s, threshold, names.has(s.channel));
}

/** Suppressed ids for one threshold, loaded once per worker lifetime and then kept current by `track`. */
let cache: { threshold: number; ids: Set<string>; sup: Judge } | undefined; // bound: ≤ MAX_VIDEOS ids

export async function suppressedIds(threshold: number): Promise<ReadonlySet<string>> {
  if (cache?.threshold === threshold) return cache.ids;
  const sup = await judge(threshold);
  const ids = new Set<string>();
  const index = (await openDb()).transaction(VIDEOS).objectStore(VIDEOS).index('seen');
  await walk(index, IDBKeyRange.lowerBound(threshold), 'next', (c) => {
    if (sup(c.value as VideoStat)) ids.add((c.value as VideoStat).id);
    return true;
  });
  cache = { threshold, ids, sup };
  return ids;
}

export function track(s: VideoStat): void {
  if (!cache) return;
  if (cache.sup(s)) cache.ids.add(s.id);
  else cache.ids.delete(s.id);
}

export const untrack = (id: string): void => void cache?.ids.delete(id);

/** After liked channels may have changed, or rows were written behind this module's back (clear, restore). */
export const forget = (): void => void (cache = liked = undefined);
