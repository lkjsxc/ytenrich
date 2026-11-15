// Music keeps the existing visual language and labels, omitting recommendation-only figures.
import { h } from '../../shared/h.ts';
import type { DayStat, Overview } from '../../shared/types.ts';
import { dayLong, dayText, num } from './format.ts';
import { kpis } from './overview.ts';
import { card, columns } from './parts.ts';
import { buckets, totals } from './period.ts';

export function musicTop(
  o: Overview,
  days: readonly DayStat[],
  previous: readonly DayStat[],
): HTMLElement[] {
  const t = totals(days);
  const p = totals(previous);
  // Reuse the Videos opened tile, without its recommendation subtitle.
  const tiles = kpis(t, p, o);
  const opened = tiles.children[2] as HTMLElement;
  opened.querySelector('.sub')?.remove();
  tiles.replaceChildren(opened);
  const list = buckets(days, 120);
  const daily = columns(
    list.map((d) => ({
      parts: [['fresh', d.opened]],
      tip: `${dayLong(d.day)} · ${num(d.opened)} opened`,
    })),
    [list[0], list[Math.floor(list.length / 2)], list.at(-1)].map((d) => (d ? dayText(d.day) : '')),
    'Point at a day for details.',
  );
  const hours = columns(
    t.hours.map((n, hour) => ({
      parts: [['fresh', n]],
      tip: `${hour}:00–${hour + 1}:00 · ${num(n)} opened`,
    })),
    ['0h', '6h', '12h', '18h', '24h'],
    'Time of day',
  );
  return [
    tiles,
    card('Videos opened', daily),
    card('Time of day', hours),
    h(
      'p',
      { class: 'muted' },
      `${num(o.videos)} videos and ${num(o.channels)} channels tracked on this device.`,
    ),
  ];
}
