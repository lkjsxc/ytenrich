// Ranking for the Recommended view. Pure: candidates are videos YouTube offered that are still unopened, and
// the order comes from the user's own record, so it favors what this person actually opens. A score multiplies:
// channel liking × title taste (shared/taste.ts) × freshness × YouTube's insistence ÷ times passed over.
import { affinity, type Taste } from './taste.ts';
import type { ChannelStat, VideoStat } from './types.ts';

const HOUR = 3600_000;
const HALF_LIFE_H = 48; // a recommendation loses half its pull every two days
const REPEAT = 0.6; // each further video of one channel counts this much less, so no channel floods the list
export const PER_CHANNEL = 4; // videos listed under one channel in the channel grouping

type Channels = ReadonlyMap<string, ChannelStat>;
const NO_TASTE: Taste = new Map();

/** How much this person likes a channel: how often they open it, and how often per time it is shown. */
export function channelScore(c: ChannelStat | undefined): number {
  if (!c) return 0.35;
  const loyalty = c.opened / (c.opened + 3);
  const rate = Math.min(0.5, (c.opened + 1) / (c.seen + 10));
  return (0.35 + 1.5 * loyalty + 2 * rate) / (1 + c.dismissed);
}

const recency = (v: VideoStat, now: number): number =>
  0.3 + 0.7 * 0.5 ** (Math.max(0, now - v.lastSeen) / HOUR / HALF_LIFE_H);

/** Offered on several page views: YouTube's own model rates it for this person (up to +48%). */
const insistence = (v: VideoStat): number => 1 + 0.12 * Math.min(4, Math.max(0, v.offers - 1));

/** Lowered each time it was on screen again and still not opened. */
export function videoScore(
  v: VideoStat,
  c: ChannelStat | undefined,
  now: number,
  taste: Taste = NO_TASTE,
): number {
  const pull = channelScore(c) * affinity(taste, v.title) * recency(v, now) * insistence(v);
  return pull / (1 + Math.max(0, v.seen - 1) * 0.35);
}

function byChannel(videos: readonly VideoStat[], channels: Channels, now: number, taste: Taste) {
  const groups = new Map<string, { v: VideoStat; score: number }[]>(); // bound: the candidates passed in
  for (const v of videos) {
    const list = groups.get(v.channel) ?? [];
    list.push({ v, score: videoScore(v, channels.get(v.channel), now, taste) });
    groups.set(v.channel, list);
  }
  for (const list of groups.values()) list.sort((a, b) => b.score - a.score);
  return groups;
}

/** Best first, with channels interleaved: the k-th video of a channel is weighted by REPEAT^k. */
export function rankVideos(
  videos: readonly VideoStat[],
  channels: Channels,
  now: number,
  taste: Taste = NO_TASTE,
): VideoStat[] {
  const all = [...byChannel(videos, channels, now, taste)].flatMap(([name, list]) =>
    list.map((e, k) => ({ v: e.v, score: e.score * (name ? REPEAT ** k : 1) })),
  );
  return all.sort((a, b) => b.score - a.score).map((e) => e.v);
}

/** Grouped by channel, most liked channel first, each with its best few videos. */
export function rankByChannel(
  videos: readonly VideoStat[],
  channels: Channels,
  now: number,
  taste: Taste = NO_TASTE,
): VideoStat[] {
  const groups = [...byChannel(videos, channels, now, taste)].filter(([name]) => name);
  const weight = (name: string, best: number): number => channelScore(channels.get(name)) * best;
  groups.sort((a, b) => weight(b[0], b[1][0]?.score ?? 0) - weight(a[0], a[1][0]?.score ?? 0));
  return groups.flatMap(([, list]) => list.slice(0, PER_CHANNEL).map((e) => e.v));
}
