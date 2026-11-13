// Period sections of the Stats view: headline tiles, the daily chart and the where/when breakdowns.
import { h } from '../../shared/h.ts';
import type { DayStat, Overview, Surface } from '../../shared/types.ts';
import { dayLong, dayText, num, pct } from './format.ts';
import { card, columns, hbars, legend } from './parts.ts';
import { change, ratio, type Totals } from './period.ts';

function tile(label: string, value: string, sub: string, delta?: number | null): HTMLElement {
  const d =
    delta === null || delta === undefined || Math.abs(delta) < 0.005
      ? null
      : h(
          'span',
          { class: 'delta', title: 'Change against the previous period' },
          ` ${delta > 0 ? '▲' : '▼'} ${pct(Math.abs(delta))}`,
        );
  return h(
    'div',
    { class: 'tile' },
    h('span', { class: 'k' }, label),
    h('b', null, value, d),
    h('span', { class: 'sub', title: sub }, sub),
  );
}

export function kpis(cur: Totals, prev: Totals, o: Overview): HTMLElement {
  const repeats = cur.seen - cur.fresh;
  return h(
    'div',
    { class: 'tiles' },
    tile(
      'Recommendations shown',
      num(cur.seen),
      `${num(cur.fresh)} new videos`,
      change(cur.seen, prev.seen),
    ),
    tile('Repeats', pct(ratio(repeats, cur.seen)), `${num(repeats)} shown before`),
    tile(
      'Videos opened',
      num(cur.opened),
      `${num(cur.picked)} had been recommended`,
      change(cur.opened, prev.opened),
    ),
    tile('Pick rate', pct(ratio(cur.picked, cur.seen)), 'opened per recommendation shown'),
    tile('Hidden by ytenrich', num(cur.hidden), `${num(o.suppressed)} videos over-exposed now`),
    tile('Not interested', num(cur.dismissed), 'sent with ⊘'),
  );
}

export function dailyCard(list: readonly DayStat[]): HTMLElement {
  const cols = list.map((d) => ({
    parts: [
      ['repeat', d.seen - d.fresh],
      ['fresh', d.fresh],
    ] as const,
    tip:
      `${dayLong(d.day)} · ${num(d.seen)} shown (${num(d.fresh)} new, ${num(d.seen - d.fresh)} repeats)` +
      ` · ${num(d.opened)} opened · ${num(d.hidden)} hidden`,
  }));
  const mid = list[Math.floor(list.length / 2)];
  const labels = [list[0], mid, list[list.length - 1]].map((d) => (d ? dayText(d.day) : ''));
  return card(
    [
      'Recommendations per day',
      legend([
        ['fresh', 'New'],
        ['repeat', 'Repeats'],
      ]),
    ],
    columns(cols, labels, 'Point at a day for details.'),
  );
}

const SURFACES: Record<Surface, string> = {
  home: 'Home',
  watch: 'Watch page',
  search: 'Search',
  channel: 'Channel pages',
  subs: 'Subscriptions',
  shorts: 'Shorts player',
  other: 'Other pages',
};

export function breakdowns(t: Totals): HTMLElement {
  const where = (Object.entries(t.surfaces) as [Surface, number][])
    .filter(([, n]) => n > 0)
    .sort((a, b) => b[1] - a[1])
    .map(([k, n]) => [SURFACES[k] ?? k, n] as const);
  const hours = t.hours.map((n, hour) => ({
    parts: [['fresh', n]] as const,
    tip: `${hour}:00–${hour + 1}:00 · ${num(n)} shown`,
  }));
  return h(
    'div',
    { class: 'cards' },
    card('Where they appear', hbars(where)),
    card(
      'Videos and Shorts',
      hbars([
        ['Videos', t.seen - t.shorts],
        ['Shorts', t.shorts],
      ]),
    ),
    card(
      'Time of day',
      columns(hours, ['0h', '6h', '12h', '18h', '24h'], 'Recommendations shown by hour of day.'),
    ),
  );
}
