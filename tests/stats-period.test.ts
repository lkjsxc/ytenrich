import { describe, expect, it } from 'vitest';
import { addChannel, addDay, emptyDay, normDay } from '../src/shared/stats-rules.ts';
import { dayKey } from '../src/shared/types.ts';
import { change, niceMax, series, totals } from '../src/views/stats/period.ts';

const NOW = new Date(2026, 10, 10, 15, 30).getTime();

describe('day and channel counters', () => {
  it('adds deltas, surfaces and the local hour of impressions', () => {
    const a = addDay(undefined, NOW, { seen: 3, fresh: 2, shorts: 1, surfaces: { home: 3 } });
    const b = addDay(a, NOW, { seen: 1, hidden: 2, surfaces: { home: 1, watch: 0 } });
    expect(b).toMatchObject({ day: dayKey(NOW), seen: 4, fresh: 2, hidden: 2, shorts: 1 });
    expect(b.surfaces).toEqual({ home: 4, watch: 0 });
    expect(b.hours[15]).toBe(4);
    expect(addDay(b, NOW, { opened: 1, picked: 1 }).hours[15]).toBe(4);
  });
  it('fills rows written before the newer fields existed', () => {
    const d = normDay({ day: '2026-11-01', seen: 5, opened: 1, dismissed: 0 });
    expect(d).toEqual({ ...emptyDay('2026-11-01'), seen: 5, opened: 1 });
  });
  it('accumulates channels and moves lastSeen only on impressions', () => {
    const a = addChannel(undefined, 'ch', 100, { seen: 2, videos: 1 });
    const b = addChannel(a, 'ch', 200, { opened: 1 });
    expect(b).toEqual({ name: 'ch', seen: 2, videos: 1, opened: 1, dismissed: 0, lastSeen: 100 });
    expect(addChannel(b, 'ch', 300, { seen: 1 }).lastSeen).toBe(300);
  });
});

describe('period math', () => {
  const days = [
    addDay(undefined, NOW, { seen: 10, fresh: 4, surfaces: { home: 10 } }),
    addDay(undefined, NOW - 2 * 86_400_000, { seen: 6, fresh: 6, surfaces: { watch: 6 } }),
    addDay(undefined, NOW - 8 * 86_400_000, { seen: 8, fresh: 1 }),
  ];
  it('builds a continuous series with zero days, oldest first', () => {
    const s = series(days, 7, NOW);
    expect(s.map((d) => d.seen)).toEqual([0, 0, 0, 0, 6, 0, 10]);
    expect(s[6]?.day).toBe(dayKey(NOW));
    expect(series(days, 7, NOW, 7).map((d) => d.seen)).toEqual([0, 0, 0, 0, 0, 8, 0]);
  });
  it('sums totals and compares periods', () => {
    const t = totals(series(days, 7, NOW));
    expect(t).toMatchObject({ seen: 16, fresh: 10, surfaces: { home: 10, watch: 6 } });
    expect(t.hours[15]).toBe(16);
    expect(change(16, 8)).toBe(1);
    expect(change(5, 0)).toBeNull();
  });
  it('rounds axis maxima up to 1/2/5 steps', () => {
    expect([1, 3, 20, 51, 320, 1000].map(niceMax)).toEqual([1, 5, 20, 100, 500, 1000]);
  });
});
