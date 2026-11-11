import { describe, expect, it } from 'vitest';
import {
  applyImpression,
  applyOffer,
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
  it('keeps an offered recommendation without counting it as shown', () => {
    const o = applyOffer(undefined, imp, 1);
    expect([o.seen, o.title, o.lastSeen, o.surfaces]).toEqual([0, 'T', 1, {}]);
    const again = applyOffer(applyImpression(o, imp, 2), { ...imp, title: '' }, 3);
    expect([again.seen, again.title, again.lastSeen, again.firstSeen]).toEqual([1, 'T', 3, 1]);
    expect(isSuppressed(applyOffer(again, imp, 4), 1)).toBe(true);
  });

  it('counts impressions per surface and suppresses at threshold', () => {
    let s = applyImpression(undefined, imp, 1);
    for (let i = 0; i < 4; i++) s = applyImpression(s, { ...imp, surface: 'watch' }, 2 + i);
    expect(s.seen).toBe(5);
    expect(s.surfaces).toEqual({ home: 1, watch: 4 });
    expect(s.firstSeen).toBe(1);
    expect(isSuppressed(s, 5)).toBe(true);
    expect(isSuppressed(s, 6)).toBe(false);
    expect(isSuppressed({ ...s, opened: 1 }, 5)).toBe(false);
    expect(isSuppressed({ ...s, allowed: true }, 5)).toBe(false);
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
});
