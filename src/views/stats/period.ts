// Pure period math for the Stats view: continuous day series, totals and comparisons.
import { emptyDay } from '../../shared/stats-rules.ts';
import { type DayStat, dayKey, type Surface } from '../../shared/types.ts';

/** Days in the period; 0 is everything on record. */
export type Range = 7 | 30 | 90 | 0;
export const RANGES: readonly Range[] = [7, 30, 90, 0];
export type Totals = Omit<DayStat, 'day'>;

const DAY_MS = 86_400_000;

/** `range` consecutive local days ending `offset` days before today, oldest first. Missing days are zero. */
export function series(
  days: readonly DayStat[],
  range: number,
  now: number,
  offset = 0,
): DayStat[] {
  const byDay = new Map(days.map((d) => [d.day, d]));
  const noon = new Date(now).setHours(12, 0, 0, 0); // noon keeps day steps clear of DST shifts
  const out: DayStat[] = [];
  for (let i = offset + range - 1; i >= offset; i--) {
    const key = dayKey(noon - i * DAY_MS);
    out.push(byDay.get(key) ?? emptyDay(key));
  }
  return out;
}

export function totals(list: readonly DayStat[]): Totals {
  const t: Totals = emptyDay('');
  for (const d of list) {
    t.seen += d.seen;
    t.fresh += d.fresh;
    t.opened += d.opened;
    t.picked += d.picked;
    t.dismissed += d.dismissed;
    t.hidden += d.hidden;
    t.shorts += d.shorts;
    for (const [k, n] of Object.entries(d.surfaces) as [Surface, number][])
      t.surfaces[k] = (t.surfaces[k] ?? 0) + n;
    d.hours.forEach((n, h) => {
      t.hours[h] = (t.hours[h] ?? 0) + n;
    });
  }
  return t;
}

export const ratio = (part: number, whole: number): number | null =>
  whole > 0 ? part / whole : null;

/** Relative change against the previous period; null without a baseline. */
export const change = (cur: number, prev: number): number | null =>
  prev > 0 ? (cur - prev) / prev : null;

/** Smallest 1/2/5 × 10^k at or above `n` (axis maximum). */
export function niceMax(n: number): number {
  const p = 10 ** Math.floor(Math.log10(Math.max(n, 1)));
  return [1, 2, 5, 10].map((m) => m * p).find((v) => v >= n) ?? n;
}

/** Days from the oldest recorded day through today (at least 1): the length of the "all time" period. */
export function span(days: readonly DayStat[], now: number): number {
  const first = [...days.map((d) => d.day), dayKey(now)].sort()[0] ?? dayKey(now); // ISO keys sort by date
  const [y = 0, m = 1, d = 1] = first.split('-').map(Number);
  const noon = new Date(now).setHours(12, 0, 0, 0);
  return Math.max(1, Math.round((noon - new Date(y, m - 1, d, 12).getTime()) / DAY_MS) + 1);
}

/** Sums consecutive days into at most `max` buckets, each named after its first day (charts of long periods). */
export function buckets(list: readonly DayStat[], max: number): DayStat[] {
  const size = Math.ceil(list.length / max);
  if (size <= 1) return [...list];
  const out: DayStat[] = [];
  for (let i = 0; i < list.length; i += size)
    out.push({ ...totals(list.slice(i, i + size)), day: list[i]?.day ?? '' });
  return out;
}
