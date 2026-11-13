// Diversified ordering for the Recommended list. Pure. A plain sort by score lets one strong signal (a channel
// opened once, the words of one opened title, the related list of the video just watched) fill a whole screen,
// and what fills the screen gets opened and so grows stronger: a local optimum. Greedy re-ranking breaks it: each
// slot takes the best candidate after penalties for repeating the channel, the topic (title words) or the page
// view of recent picks, and every EXPLORE_EVERY-th slot ranks by YouTube's signals alone, so the list keeps
// sampling beyond what the user's record already favors.
import type { VideoStat } from './types.ts';

export type Cand = {
  readonly v: VideoStat;
  /** Full score (shared/recommend.ts `videoScore`). */
  readonly score: number;
  /** Score without the learned parts (`exploreScore`). */
  readonly explore: number;
  readonly toks: ReadonlySet<string>;
  /** Page view that offered it (same surface, within a couple of minutes). */
  readonly batch: string;
};

const REPEAT = 0.6; // per earlier pick of the same channel anywhere above
const STREAK = 0.7; // and again per pick of it among the last STREAK_N
const STREAK_N = 3;
const WINDOW = 6; // recent picks a title and a page view are compared with
const SIMILAR = 0.65; // a title worded like a recent pick keeps only 35% of its score
const BATCH = 0.85; // per recent pick offered on the same page view
export const EXPLORE_EVERY = 5;
const DEPTH = 1000; // slots re-ranked (lists show at most this many); the rest follow by score

/** Jaccard overlap of two token sets (0 when either is empty). */
export function overlap(a: ReadonlySet<string>, b: ReadonlySet<string>): number {
  if (!a.size || !b.size) return 0;
  let n = 0;
  for (const t of a) if (b.has(t)) n++;
  return n / (a.size + b.size - n);
}

export function diversify(cands: readonly Cand[], perChannel = true): Cand[] {
  const byScore = [...cands].sort((a, b) => b.score - a.score);
  const byExplore = [...cands].sort((a, b) => b.explore - a.explore);
  const used = new Set<Cand>(); // bound: the candidates passed in
  const counts = new Map<string, number>(); // bound: their channels
  const out: Cand[] = [];

  const factor = (c: Cand, recent: readonly Cand[]): number => {
    let f = 1;
    let sim = 0;
    const ch = c.v.channel;
    if (perChannel && ch) f *= REPEAT ** (counts.get(ch) ?? 0);
    recent.forEach((r, i) => {
      if (perChannel && ch && r.v.channel === ch && i >= recent.length - STREAK_N) f *= STREAK;
      if (r.batch === c.batch) f *= BATCH;
      sim = Math.max(sim, overlap(c.toks, r.toks));
    });
    return f * (1 - SIMILAR * sim);
  };
  // Penalties only lower a value, so the scan stops at the first candidate whose bare value cannot win.
  const pick = (list: readonly Cand[], key: 'score' | 'explore'): Cand | undefined => {
    const recent = out.slice(-WINDOW);
    let best: Cand | undefined;
    let top = -1;
    for (const c of list) {
      if (used.has(c)) continue;
      if (c[key] <= top) break;
      const value = c[key] * factor(c, recent);
      if (value > top) (best = c), (top = value);
    }
    return best;
  };

  while (out.length < Math.min(DEPTH, cands.length)) {
    const explore = out.length % EXPLORE_EVERY === EXPLORE_EVERY - 1;
    const c = explore ? pick(byExplore, 'explore') : pick(byScore, 'score');
    if (!c) break;
    used.add(c);
    out.push(c);
    counts.set(c.v.channel, (counts.get(c.v.channel) ?? 0) + 1);
  }
  for (const c of byScore) if (!used.has(c)) out.push(c);
  return out;
}
