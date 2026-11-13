// Ranking for the Recommended view. Pure: candidates are videos YouTube offered (unopened, unless a tab asks for
// opened ones too), and the order comes from the user's own record. A score multiplies: channel liking × title
// taste (shared/taste.ts) × freshness × YouTube's insistence ÷ times passed over. `shared/diversify.ts` then
// re-ranks so no channel, topic or single page floods the list, and every few slots trust YouTube over the taste.
import { type Cand, diversify } from './diversify.ts';
import { affinity, type Taste, tokens } from './taste.ts';
import type { ChannelStat, VideoStat } from './types.ts';

const HOUR = 3600_000;
const HALF_LIFE_H = 48; // a recommendation loses half its pull every two days
const BATCH_MS = 120_000; // offers this close together came from one page view
export const PER_CHANNEL = 4; // videos listed under one channel in the channel grouping
const UNKNOWN = 0.5; // liking of a channel without a record

type Channels = ReadonlyMap<string, ChannelStat>;
const NO_TASTE: Taste = new Map();

/**
 * How much this person likes a channel: how often they open it, and how often per time it is shown. Evidence
 * is weighed: one open is a hint (about ×1.6 over an unknown channel), a dozen a verdict (about ×3). A channel
 * shown again and again without an open sinks, but never below ×0.6, so it can still win a slot.
 */
export function channelScore(c: ChannelStat | undefined): number {
  if (!c || c.seen + c.opened + c.dismissed === 0) return UNKNOWN; // unknown, or known only by its avatar
  const loyalty = c.opened / (c.opened + 4);
  const rate = Math.min(0.5, (c.opened + 0.5) / (c.seen + 12));
  const neglect = c.seen / (10 * (c.opened + 1));
  const sink = Math.max(0.6, 1 / (1 + 0.1 * neglect));
  return ((UNKNOWN + loyalty + 1.2 * rate) * sink) / (1 + 0.7 * c.dismissed);
}

const recency = (v: VideoStat, now: number): number =>
  0.3 + 0.7 * 0.5 ** (Math.max(0, now - v.lastSeen) / HOUR / HALF_LIFE_H);

/** Offered on several page views: YouTube's own model rates it for this person (up to +48%). */
const insistence = (v: VideoStat): number => 1 + 0.12 * Math.min(4, Math.max(0, v.offers - 1));

/** Lowered each time it was on screen again and still not opened. */
const fatigue = (v: VideoStat): number => 1 + Math.max(0, v.seen - 1) * 0.35;

export function videoScore(
  v: VideoStat,
  c: ChannelStat | undefined,
  now: number,
  taste: Taste = NO_TASTE,
): number {
  const pull = channelScore(c) * affinity(taste, v.title) * recency(v, now) * insistence(v);
  return pull / fatigue(v);
}

/** YouTube's side of the score alone (fresh, insisted on, not passed over), for the exploration slots. Channels
 * the user called "Not interested" stay down there too. */
export function exploreScore(v: VideoStat, c: ChannelStat | undefined, now: number): number {
  return (recency(v, now) * insistence(v)) / fatigue(v) / (1 + (c?.dismissed ?? 0));
}

/** Best first, diversified. `perChannel: false` when every candidate is of one channel anyway. */
export function rankVideos(
  videos: readonly VideoStat[],
  channels: Channels,
  now: number,
  taste: Taste = NO_TASTE,
  perChannel = true,
): VideoStat[] {
  const cands = videos.map((v): Cand => {
    const c = channels.get(v.channel);
    return {
      v,
      score: videoScore(v, c, now, taste),
      explore: exploreScore(v, c, now),
      toks: new Set(tokens(v.title)),
      batch: `${v.via}:${Math.round(v.lastSeen / BATCH_MS)}`,
    };
  });
  return diversify(cands, perChannel).map((c) => c.v);
}

/** Newest upload first (the first sighting stands in for an unknown upload time). */
export const rankNewest = (videos: readonly VideoStat[]): VideoStat[] =>
  [...videos].sort((a, b) => (b.published || b.firstSeen) - (a.published || a.firstSeen));

/** Under channel headings: channels in the order their best video ranks, `per` videos each, unnamed ones left out. */
export function groupByChannel(ranked: readonly VideoStat[], per = PER_CHANNEL): VideoStat[] {
  const groups = new Map<string, VideoStat[]>(); // bound: the candidates passed in
  for (const v of ranked) {
    if (!v.channel) continue;
    const list = groups.get(v.channel) ?? [];
    if (list.length < per) list.push(v);
    groups.set(v.channel, list);
  }
  return [...groups.values()].flat();
}
