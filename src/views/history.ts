// History: each time you opened a video while stats were enabled, newest first, grouped by day.
// It is ytenrich's own record (this device only), so it works as a tile on every page.

import { h } from '../shared/h.ts';
import { onStatsChanged } from '../shared/protocol.ts';
import { dayKey, type HistoryPage, type HistoryQuery } from '../shared/types.ts';
import { SITE } from '../youtube/site.ts';
import { historyRow } from './history-row.ts';
import { autoMore, grow, type Keyed, keyed } from './more.ts';
import type { ViewEnv } from './registry.ts';
import { dayText } from './stats/format.ts';

const STEP = 50;
const SEARCH_MS = 200;

export function mountHistory(el: HTMLElement, env: ViewEnv): () => void {
  const q: HistoryQuery = { limit: STEP, search: '', origin: SITE };
  const expanded = new Set<string>(); // bound: event ids explicitly expanded during this tab’s lifetime
  let token = 0;
  let sig = '';
  let timer: ReturnType<typeof setTimeout> | undefined;
  const list = h('div', { class: 'history' });
  const foot = h('div');
  const search = h('input', {
    type: 'search',
    placeholder: 'Search history',
    oninput: () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        q.search = search.value;
        q.limit = STEP;
        refresh();
      }, SEARCH_MS);
    },
  });

  const paint = (page: HistoryPage): void => {
    const out: Keyed[] = [];
    let day = '';
    const img = env.settings.get().thumbnailsEnabled;
    for (const event of page.rows) {
      const v = event.row;
      const key = dayKey(event.time);
      if (key !== day) out.push([`day${key}`, () => h('h3', null, dayText(key))]);
      day = key;
      out.push([
        `${img}${event.id}${JSON.stringify(v)}`,
        () => historyRow(event, env, expanded, list),
      ]);
    }
    keyed(list, out);
    foot.replaceChildren(
      ...(page.rows.length
        ? []
        : [
            h(
              'p',
              { class: 'muted' },
              q.search
                ? 'No opened videos match.'
                : env.settings.get().statsEnabled
                  ? 'Nothing here yet. Videos you open appear here.'
                  : 'History is kept while stats are enabled (see the Stats tab).',
            ),
          ]),
      ...[
        autoMore(page.next !== null, q.limit, () => {
          q.limit = grow(q.limit, STEP);
          refresh();
        }),
      ].filter((n) => n !== null),
    );
  };

  function refresh(): void {
    const my = ++token;
    env.call('history', q).then(
      (page) => {
        const next = JSON.stringify([page, env.settings.get()]);
        if (my !== token || next === sig) return;
        sig = next;
        paint(page);
      },
      (e: unknown) => foot.replaceChildren(h('p', { class: 'error' }, String(e))),
    );
  }

  el.replaceChildren(h('div', { class: 'stats-head' }, search), list, foot);
  refresh();
  const offStats = onStatsChanged(refresh);
  const offSettings = env.settings.subscribe(refresh);
  return () => {
    offStats();
    offSettings();
    clearTimeout(timer);
    token = -1;
  };
}
