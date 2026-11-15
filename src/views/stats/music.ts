// Music wording and charts, omitting recommendation-only figures.
import { h } from '../../shared/h.ts';
import type { DayStat, Overview } from '../../shared/types.ts';
import { dayLong, dayText, num } from './format.ts';
import { tile } from './overview.ts';
import { card, columns } from './parts.ts';
import { buckets, change, totals } from './period.ts';
import type { StatsWords } from './table-options.ts';

export const MUSIC_WORDS: StatsWords = {
  channels: 'Artists',
  channel: 'Artist',
  videos: 'Tracks',
  video: 'Track',
  opened: 'Plays',
  search: 'Search title or artist',
};
const plays = (n: number): string => `${num(n)} ${n === 1 ? 'play' : 'plays'}`;

export function musicTop(
  o: Overview,
  days: readonly DayStat[],
  previous: readonly DayStat[],
): HTMLElement[] {
  const t = totals(days);
  const p = totals(previous);
  const tiles = h(
    'div',
    { class: 'tiles' },
    tile('Plays', num(t.opened), '', change(t.opened, p.opened)),
  );
  tiles.querySelector('.sub')?.remove();
  const list = buckets(days, 120);
  const daily = columns(
    list.map((d) => ({
      parts: [['fresh', d.opened]],
      tip: `${dayLong(d.day)} · ${plays(d.opened)}`,
    })),
    [list[0], list[Math.floor(list.length / 2)], list.at(-1)].map((d) => (d ? dayText(d.day) : '')),
    'Point at a day for details.',
  );
  const hours = columns(
    t.hours.map((n, hour) => ({
      parts: [['fresh', n]],
      tip: `${hour}:00–${hour + 1}:00 · ${plays(n)}`,
    })),
    ['0h', '6h', '12h', '18h', '24h'],
    'Time of day',
  );
  return [
    tiles,
    card('Plays', daily),
    card('Time of day', hours),
    h(
      'p',
      { class: 'muted' },
      `${num(o.videos)} ${o.videos === 1 ? 'track' : 'tracks'} and ${num(o.channels)} ${o.channels === 1 ? 'artist' : 'artists'} recorded on this device.`,
    ),
  ];
}
