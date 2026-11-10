// History: the videos you opened while stats were enabled, newest first, grouped by day.
// It is ytenrich's own record (this device only), so it works as a tile on every page.
import { h } from '../shared/h.ts';
import { onStatsChanged } from '../shared/protocol.ts';
import { dayKey, type StatsPage, type StatsQuery, type VideoStat } from '../shared/types.ts';
import { autoMore, grow, type Keyed, keyed } from './more.ts';
import { openVideo, videoUrl } from './open.ts';
import type { ViewEnv } from './registry.ts';
import { dayFull } from './stats/format.ts';

const STEP = 50;
const SEARCH_MS = 200;

export function mountHistory(el: HTMLElement, env: ViewEnv): () => void {
  const q: StatsQuery = {
    sort: 'openedAt',
    filter: 'opened',
    kind: 'all',
    channel: '',
    limit: STEP,
    search: '',
  };
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

  const row = (v: VideoStat): HTMLElement =>
    h(
      'a',
      {
        class: 'hrow',
        href: videoUrl(v.id, v.kind),
        onclick: (e) => openVideo(e as MouseEvent, v.id, v.kind, env),
      },
      h(
        'span',
        { class: 'muted num' },
        new Date(v.openedAt).toLocaleTimeString('en', {
          hour: '2-digit',
          minute: '2-digit',
          hourCycle: 'h23',
        }),
      ),
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
      h(
        'span',
        { class: 'htext' },
        v.title || v.id,
        v.kind === 'short' ? h('span', { class: 'badge' }, 'Short') : null,
        v.opened > 1 ? h('span', { class: 'badge' }, `opened ${v.opened}×`) : null,
        h('div', { class: 'muted' }, v.channel),
      ),
    );

  const paint = (page: StatsPage): void => {
    const out: Keyed[] = [];
    let day = '';
    const img = env.settings.get().thumbnailsEnabled;
    for (const v of page.rows) {
      const key = dayKey(v.openedAt);
      if (key !== day) out.push([`day${key}`, () => h('h3', null, dayFull(key))]);
      day = key;
      out.push([`${img}${v.id}${v.openedAt}${v.opened}${v.title}`, () => row(v)]);
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
        autoMore(page.more, q.limit, () => {
          q.limit = grow(q.limit, STEP);
          refresh();
        }),
      ].filter((n) => n !== null),
    );
  };

  function refresh(): void {
    const my = ++token;
    env.call('query', q).then(
      (page) => {
        const next = JSON.stringify([page, env.settings.get()]);
        if (my !== token || next === sig) return;
        sig = next;
        paint(page);
      },
      (e: unknown) => foot.replaceChildren(h('p', { class: 'error' }, String(e))),
    );
  }

  el.replaceChildren(
    h('div', { class: 'stats-head' }, h('h2', null, 'History'), search),
    list,
    foot,
  );
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
