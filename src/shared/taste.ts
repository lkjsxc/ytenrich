// Taste model for the Recommended ranking. Pure: it learns which title words mark videos this person opens
// and which mark videos they reject, and scores a new title by them.

const WORD = /[\p{L}\p{N}]+/gu;
const CJK = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]/u;
const MAX_TOKENS = 40; // per title

/** Lower-cased words; runs of CJK text (written without spaces) become overlapping character pairs. */
export function tokens(title: string): string[] {
  const out = new Set<string>(); // bound: MAX_TOKENS
  for (const word of title.toLowerCase().match(WORD) ?? []) {
    if (out.size >= MAX_TOKENS) break;
    if (!CJK.test(word)) {
      if (word.length > 1) out.add(word);
      continue;
    }
    const chars = [...word];
    for (let i = 0; i + 1 < chars.length && out.size < MAX_TOKENS; i++)
      out.add(`${chars[i]}${chars[i + 1]}`);
  }
  return [...out];
}

export type Taste = ReadonlyMap<string, number>;

function counts(titles: readonly string[]): Map<string, number> {
  const m = new Map<string, number>(); // bound: tokens of the titles passed in
  for (const t of titles) for (const k of tokens(t)) m.set(k, (m.get(k) ?? 0) + 1);
  return m;
}

/**
 * Weight per token: the smoothed log-odds of it appearing in an opened title against a passed-over one
 * (shown or dismissed, never opened). Dismissed titles count three times. Positive means "this person opens these".
 */
export function learn(
  opened: readonly string[],
  ignored: readonly string[],
  dismissed: readonly string[],
): Taste {
  const yes = counts(opened);
  const no = counts(ignored);
  for (const [k, n] of counts(dismissed)) no.set(k, (no.get(k) ?? 0) + 3 * n);
  const yesAll = opened.length + 1;
  const noAll = ignored.length + 3 * dismissed.length + 1;
  const taste = new Map<string, number>(); // bound: tokens of the titles passed in
  for (const k of new Set([...yes.keys(), ...no.keys()])) {
    const y = yes.get(k) ?? 0;
    const n = no.get(k) ?? 0;
    if (y + n < 2) continue; // one sighting says nothing
    taste.set(k, Math.log((y + 0.5) / yesAll) - Math.log((n + 0.5) / noAll));
  }
  return taste;
}

/** Multiplier around 1 (0.5 to 2): above when the title's known words lean opened, below when they lean rejected. */
export function affinity(taste: Taste, title: string): number {
  let sum = 0;
  let known = 0;
  for (const k of tokens(title)) {
    const w = taste.get(k);
    if (w === undefined) continue;
    sum += Math.max(-3, Math.min(3, w));
    known++;
  }
  if (!known) return 1;
  // Few known words say little: the mean is shrunk toward 0 as if two neutral words were also present.
  return 2 ** Math.max(-1, Math.min(1, (sum / (known + 2)) * 0.7));
}
