import { expect, it } from 'vitest';
import { createPlayRule, type PlaySample } from '../src/shared/music-play.ts';

const sample = (id = 'a', position = 0, now = position * 1000): PlaySample => ({
  id,
  position,
  now,
  playing: true,
  seeking: false,
  ended: false,
  rate: 1,
});
it('qualifies queue, autoplay, next/previous and shelf changes separately, skips short starts', () => {
  const rule = createPlayRule();
  expect(rule(sample())).toBeNull();
  expect(rule(sample('a', 9))).toBeNull();
  expect(rule(sample('b', 0, 9000))).toBeNull();
  expect(rule(sample('b', 10, 19000))).toBe(9000);
  expect(rule(sample('b', 20, 29000))).toBeNull();
  expect(rule(sample('a', 0, 30000))).toBeNull();
  expect(rule(sample('a', 10, 40000))).toBe(30000);
});
it('navigation, pause/resume and seeks without a track change never add starts', () => {
  const rule = createPlayRule();
  rule(sample());
  expect(rule(sample())).toBeNull(); // navigation refreshes the same player
  expect(rule({ ...sample('a', 80, 1000), seeking: true })).toBeNull();
  rule(sample('a', 80, 1100));
  expect(rule(sample('a', 90, 11100))).toBe(0);
  rule({ ...sample('a', 90, 11100), playing: false });
  rule(sample('a', 90, 21100));
  expect(rule(sample('a', 100, 31100))).toBeNull();
});
it('replay from the beginning after ended qualifies once more after ten seconds', () => {
  const rule = createPlayRule();
  rule(sample());
  expect(rule(sample('a', 10))).toBe(0);
  rule({ ...sample('a', 100, 100000), ended: true, playing: false });
  rule(sample('a', 0, 101000));
  expect(rule(sample('a', 9, 110000))).toBeNull();
  expect(rule(sample('a', 10, 111000))).toBe(101000);
});
it('buffering, seeking and paused wall time cannot qualify a skipped track', () => {
  const rule = createPlayRule();
  rule(sample());
  rule({ ...sample('a', 4), playing: false });
  rule(sample('a', 4, 100000));
  expect(rule(sample('a', 9, 105000))).toBeNull();
  expect(rule(sample('b', 0, 105001))).toBeNull();
});
