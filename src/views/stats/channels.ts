// Most-recommended channels (cumulative counters). Picking a channel filters the video table.
import { h } from '../../shared/h.ts';
import type { ChannelSort, ChannelStat } from '../../shared/types.ts';
import { num } from './format.ts';
import { card } from './parts.ts';

export const CHANNEL_STEP = 8;
const CHANNEL_MAX = 80;

export type ChannelActions = {
  sort(sort: ChannelSort): void;
  more(): void;
  pick(name: string): void;
};

export function channelsCard(
  rows: readonly ChannelStat[],
  sort: ChannelSort,
  limit: number,
  on: ChannelActions,
): HTMLElement {
  const max = Math.max(1, ...rows.map((c) => c[sort]));
  const th = (key: ChannelSort, label: string): HTMLElement =>
    h(
      'th',
      {
        class: key === sort ? 'num sort on' : 'num sort',
        title: `Sort by ${label.toLowerCase()}`,
        onclick: () => on.sort(key),
      },
      key === sort ? `${label} ↓` : label,
    );
  const row = (c: ChannelStat): HTMLElement =>
    h(
      'tr',
      null,
      h(
        'td',
        null,
        h(
          'button',
          { class: 'link', title: 'Show this channel’s videos', onclick: () => on.pick(c.name) },
          c.name,
        ),
        h('div', { class: 'mini', style: `width:${(c[sort] / max) * 100}%` }),
      ),
      h('td', { class: 'num' }, num(c.seen)),
      h('td', { class: 'num' }, num(c.videos)),
      h('td', { class: 'num' }, num(c.opened)),
    );
  return card(
    'Most recommended channels (all time)',
    h(
      'table',
      null,
      h(
        'thead',
        null,
        h(
          'tr',
          null,
          h('th', null, 'Channel'),
          th('seen', 'Shown'),
          h('th', { class: 'num' }, 'Videos'),
          th('opened', 'Opened'),
        ),
      ),
      h('tbody', null, rows.map(row)),
    ),
    rows.length >= limit && limit < CHANNEL_MAX
      ? h('div', { class: 'actions more' }, h('button', { onclick: on.more }, 'Show more'))
      : null,
  );
}
