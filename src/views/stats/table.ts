// Video table of the Stats view: filter chips, kind, search, sortable columns, paging and the allow action.
import { h } from '../../shared/h.ts';
import { isSuppressed } from '../../shared/stats-rules.ts';
import type { StatsPage, StatsQuery, VideoStat } from '../../shared/types.ts';
import { openVideo, videoUrl } from '../open.ts';
import type { ViewEnv } from '../registry.ts';
import { ago, num } from './format.ts';
import { choice } from './parts.ts';
import { COLUMNS, FILTERS, KINDS } from './table-options.ts';

export const PAGE_STEP = 50;
const SEARCH_MS = 200;
export type VideoTable = { readonly el: HTMLElement; sync(): void; show(page: StatsPage): void };

/** `q` is mutated in place by the controls; `refresh` re-queries. */
export function createVideoTable(env: ViewEnv, q: StatsQuery, refresh: () => void): VideoTable {
  const set = (patch: Partial<StatsQuery>): void => {
    Object.assign(q, patch, { limit: PAGE_STEP });
    sync();
    refresh();
  };
  let searchTimer: ReturnType<typeof setTimeout> | undefined;
  const search = h('input', {
    type: 'search',
    placeholder: 'Search title or channel',
    oninput: () => {
      clearTimeout(searchTimer);
      searchTimer = setTimeout(() => set({ search: search.value }), SEARCH_MS);
    },
  });
  const chips = h('div');
  const headRow = h('tr');
  const body = h('tbody');
  const foot = h('div', { class: 'actions more' });

  const sync = (): void => {
    chips.replaceChildren(
      choice('chips', FILTERS, q.filter, (filter) => set({ filter })),
      h(
        'div',
        { class: 'controls' },
        h(
          'select',
          {
            onchange: (e) =>
              set({ kind: (e.target as HTMLSelectElement).value as StatsQuery['kind'] }),
          },
          KINDS.map(([v, label]) => h('option', { value: v, selected: v === q.kind }, label)),
        ),
        search,
        q.channel
          ? h(
              'button',
              {
                class: 'chip on',
                title: 'Clear channel filter',
                onclick: () => set({ channel: '' }),
              },
              `${q.channel} ×`,
            )
          : null,
      ),
    );
    headRow.replaceChildren(
      h('th'),
      h('th', null, 'Video'),
      ...COLUMNS.map(([key, label]) =>
        h(
          'th',
          { class: key === q.sort ? 'num sort on' : 'num sort', onclick: () => set({ sort: key }) },
          key === q.sort ? `${label} ↓` : label,
        ),
      ),
      h('th'),
    );
  };

  const badge = (v: VideoStat): string =>
    v.dismissedAt
      ? 'not interested'
      : v.allowed
        ? 'always shown'
        : isSuppressed(v, env.settings.get().hideThreshold)
          ? 'over-exposed'
          : '';
  const row = (v: VideoStat): HTMLElement => {
    const state = badge(v);
    const where = Object.entries(v.surfaces)
      .map(([k, n]) => `${k} ${n}`)
      .join(' · ');
    return h(
      'tr',
      null,
      h(
        'td',
        null,
        !__FIREFOX__ && env.settings.get().thumbnailsEnabled
          ? h('img', {
              class: v.kind === 'short' ? 'thumb tall' : 'thumb',
              crossorigin: 'anonymous',
              referrerpolicy: 'no-referrer',
              src: `https://i.ytimg.com/vi/${v.id}/default.jpg`,
              loading: 'lazy',
              alt: '',
            })
          : null,
      ),
      h(
        'td',
        null,
        h(
          'a',
          {
            href: videoUrl(v.id, v.kind),
            onclick: (e) => openVideo(e as MouseEvent, v.id, v.kind, env),
          },
          v.title || v.id,
        ),
        v.kind === 'short' ? h('span', { class: 'badge' }, 'Short') : null,
        state ? h('span', { class: 'badge' }, state) : null,
        v.channel
          ? h(
              'div',
              null,
              h(
                'button',
                { class: 'link muted', onclick: () => set({ channel: v.channel }) },
                v.channel,
              ),
            )
          : null,
      ),
      h('td', { class: 'num', title: where }, num(v.seen)),
      h('td', { class: 'num' }, num(v.opened)),
      h('td', { class: 'num muted' }, ago(v.lastSeen)),
      h(
        'td',
        null,
        h(
          'button',
          {
            title: v.allowed
              ? 'Let ytenrich hide this video again when it is over-exposed'
              : 'Never hide this video',
            onclick: () => void env.call('allow', { id: v.id, allowed: !v.allowed }).then(refresh),
          },
          v.allowed ? 'Undo' : 'Always show',
        ),
      ),
    );
  };

  sync();
  return {
    el: h(
      'section',
      { class: 'card' },
      h('h3', null, 'Videos'),
      chips,
      h('table', null, h('thead', null, headRow), body),
      foot,
    ),
    sync,
    show(page) {
      body.replaceChildren(
        ...(page.rows.length
          ? page.rows.map(row)
          : [h('tr', null, h('td', { colspan: 6, class: 'muted' }, 'No videos match.'))]),
      );
      foot.replaceChildren(
        ...(page.more
          ? [
              h(
                'button',
                {
                  onclick: () => {
                    q.limit += PAGE_STEP;
                    refresh();
                  },
                },
                'Show more',
              ),
            ]
          : []),
      );
    },
  };
}
