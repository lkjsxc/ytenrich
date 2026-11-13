import { describe, expect, it } from 'vitest';
import { parseAge } from '../src/shared/age.ts';
import {
  applyImpression,
  applyOffer,
  isCountName,
  isPrunable,
  isSuppressed,
  PRUNE_AGE_MS,
} from '../src/shared/stats-rules.ts';
import type { Impression } from '../src/shared/types.ts';

const imp: Impression = {
  id: 'abcdefghijk',
  kind: 'video',
  surface: 'home',
  title: 'T',
  channel: 'C',
};

describe('stats rules', () => {
  it('reads upload ages in English and Japanese and keeps the first estimate', () => {
    const H = 3600_000;
    expect(parseAge('3 months ago')).toBe(90 * 24 * H);
    expect(parseAge('2y ago')).toBe(730 * 24 * H);
    expect(parseAge('Streamed 5 hours ago')).toBe(5 * H);
    expect(parseAge('5 日前')).toBe(5 * 24 * H);
    expect(parseAge('1 か月前')).toBe(30 * 24 * H);
    expect(parseAge('5.6M views')).toBe(0);
    const first = applyOffer(undefined, { ...imp, age: '2 days ago' }, 10 * 24 * H);
    expect(first.published).toBe(8 * 24 * H);
    expect(applyImpression(first, { ...imp, age: '1 month ago' }, 50 * 24 * H).published).toBe(
      8 * 24 * H,
    );
  });

  it('keeps an offered recommendation without counting it as shown', () => {
    const o = applyOffer(undefined, imp, 1);
    expect([o.seen, o.title, o.lastSeen, o.surfaces]).toEqual([0, 'T', 1, {}]);
    const again = applyOffer(applyImpression(o, imp, 2), { ...imp, title: 'Mix' }, 3);
    expect([again.seen, again.title, again.lastSeen, again.firstSeen]).toEqual([1, 'T', 3, 1]);
    expect([again.offers, again.via]).toEqual([2, 'home']);
  });

  it('counts impressions per surface and suppresses at threshold', () => {
    let s = applyImpression(undefined, imp, 1);
    for (let i = 0; i < 4; i++) s = applyImpression(s, { ...imp, surface: 'watch' }, 2 + i);
    expect(s.seen).toBe(5);
    expect(s.surfaces).toEqual({ home: 1, watch: 4 });
    expect(s.firstSeen).toBe(1);
    const DAY = 86_400_000;
    expect(isSuppressed(s, 5, false, 10)).toBe(false); // all within one session
    const pushed = applyImpression({ ...s, seen: 4 }, imp, 2 * DAY);
    expect(isSuppressed(pushed, 5, false, 2 * DAY)).toBe(true);
    expect(isSuppressed(pushed, 6, false, 2 * DAY)).toBe(false);
    expect(isSuppressed(pushed, 5, true, 2 * DAY)).toBe(false); // a liked channel gets 3× the patience
    expect(isSuppressed({ ...pushed, seen: 15 }, 5, true, 2 * DAY)).toBe(true);
    expect(isSuppressed(pushed, 5, false, 40 * DAY)).toBe(false); // no longer pushed
    expect(isSuppressed({ ...pushed, opened: 1 }, 5, false, 2 * DAY)).toBe(false);
  });
  it('keeps known title when a later impression has none', () => {
    const s = applyImpression(applyImpression(undefined, imp, 1), { ...imp, title: '' }, 2);
    expect(s.title).toBe('T');
  });
  it('prunes only old untouched entries', () => {
    const s = applyImpression(undefined, imp, 0);
    expect(isPrunable(s, PRUNE_AGE_MS + 1)).toBe(true);
    expect(isPrunable({ ...s, opened: 1 }, PRUNE_AGE_MS + 1)).toBe(false);
    expect(isPrunable(s, 10)).toBe(false);
  });
  it('tells a view counter from a channel name', () => {
    for (const junk of [
      '121K',
      '12万',
      '6.8万',
      '987',
      '5,4 Mio.',
      '121K views',
      '12万 回視聴',
      '541 watching',
    ])
      expect(isCountName(junk), junk).toBe(true);
    for (const name of ['Rick Astley', '24 News', '3Blue1Brown', '2CELLOS', 'Lofi Girl', ''])
      expect(isCountName(name), name).toBe(false);
  });
});
