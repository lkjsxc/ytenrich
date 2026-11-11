// Upload age as YouTube words it on a tile ("3 months ago", "2y ago", "5 日前"), turned into milliseconds.
const H = 3600_000;
const UNITS: readonly (readonly [RegExp, number])[] = [
  [/^(years?|yrs?|y|年)$/, 365 * 24 * H],
  [/^(months?|mos?|[かヶカケ]月)$/, 30 * 24 * H],
  [/^(weeks?|wks?|w|週間)$/, 7 * 24 * H],
  [/^(days?|d|日)$/, 24 * H],
  [/^(hours?|hrs?|h|時間)$/, H],
  [/^(minutes?|mins?|min|m|分)$/, 60_000],
  [/^(seconds?|secs?|s|秒)$/, 1000],
];
const AGE = /(\d+)\s*([a-z]+|年|[かヶカケ]月|週間|日|時間|分|秒)\s*(ago|前)/i;

/** Milliseconds since upload, or 0 when the text is not an age (view counts, other languages). */
export function parseAge(text: string): number {
  const m = AGE.exec(text);
  const unit = m && UNITS.find(([re]) => re.test((m[2] ?? '').toLowerCase()));
  return m && unit ? Number(m[1]) * unit[1] : 0;
}
