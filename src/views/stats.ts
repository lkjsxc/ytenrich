// Recommendation statistics: summary, daily bars, and a filterable table with unhide/allow actions.
// Refreshes itself on stats changes (background rev bump), deferred while the view is not visible.
import { h } from '../shared/h.ts';
import { onStatsChanged } from '../shared/protocol.ts';
import type { StatsFilter, StatsQuery, StatsSort, Summary, VideoStat } from '../shared/types.ts';
import { openVideo, videoUrl } from './open.ts';
import type { ViewEnv } from './registry.ts';

const FILTERS: readonly StatsFilter[] = ['unopened', 'suppressed', 'all', 'opened', 'dismissed'];
const SORTS: readonly StatsSort[] = ['seen', 'lastSeen'];

const ago = (t: number): string => {
  const m = Math.round((Date.now() - t) / 60000);
  return m < 60 ? `${m}m` : m < 1440 ? `${Math.round(m / 60)}h` : `${Math.round(m / 1440)}d`;
};

function summaryEl(s: Summary): HTMLElement {
  const today = s.days[0];
  const max = Math.max(1, ...s.days.map((d) => d.seen));
  const bars = [...s.days]
    .slice(0, 14)
    .reverse()
    .map((d) =>
      h('div', {
        class: 'bar',
        title: `${d.day}: ${d.seen} seen, ${d.opened} opened, ${d.dismissed} dismissed`,
        style: `height:${(d.seen / max) * 100}%`,
      }),
    );
  const tile = (n: number | string, label: string): HTMLElement =>
    h('div', { class: 'tile' }, h('b', null, String(n)), h('span', null, label));
  return h(
    'div',
    null,
    h(
      'div',
      { class: 'tiles' },
      tile(s.videos, 'videos tracked'),
      tile(s.suppressed, 'over-exposed'),
      tile(today?.seen ?? 0, 'impressions today'),
      tile(today?.opened ?? 0, 'opened today'),
    ),
    h('div', { class: 'bars' }, bars),
  );
}

function rowEl(v: VideoStat, env: ViewEnv, refresh: () => void): HTMLElement {
  const toggle = (): void =>
    void env.call('allow', { id: v.id, allowed: !v.allowed }).then(refresh);
  return h(
    'tr',
    null,
    h(
      'td',
      null,
      !__FIREFOX__ && env.settings.get().thumbnailsEnabled
        ? h('img', {
            class: 'thumb',
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
      h('div', { class: 'muted' }, v.channel),
    ),
    h('td', { class: 'num' }, String(v.seen)),
    h('td', { class: 'num' }, String(v.opened)),
    h('td', { class: 'num muted' }, ago(v.lastSeen)),
    h(
      'td',
      null,
      h(
        'button',
        { onclick: toggle, title: 'Never hide this video' },
        v.allowed ? 'allowed' : 'allow',
      ),
    ),
  );
}

export function mountStats(el: HTMLElement, env: ViewEnv): () => void {
  const q: StatsQuery = { sort: 'seen', filter: 'unopened', limit: 200, search: '' };
  const head = h('div');
  const body = h('tbody');
  const select = <T extends string>(opts: readonly T[], key: 'sort' | 'filter'): HTMLElement =>
    h(
      'select',
      {
        onchange: (e) => (
          ((q as Record<string, unknown>)[key] = (e.target as HTMLSelectElement).value), refresh()
        ),
      },
      opts.map((o) => h('option', { value: o, selected: q[key] === o }, o)),
    );
  const note = h('p', { class: 'muted' });
  let token = 0;
  let visible = false;
  let dirty = false;
  const refresh = (): void => {
    dirty = false;
    const my = ++token;
    note.textContent = env.settings.get().statsEnabled
      ? ''
      : 'Recording is off: enable it in Settings to build your stats.';
    void Promise.all([env.call('summary', null), env.call('query', q)]).then(
      ([s, rows]) => {
        if (my !== token) return;
        head.replaceChildren(summaryEl(s));
        body.replaceChildren(...rows.map((r) => rowEl(r, env, refresh)));
      },
      (e: unknown) => head.replaceChildren(h('p', { class: 'error' }, String(e))),
    );
  };
  const changed = (): void => {
    if (visible && document.visibilityState === 'visible') refresh();
    else dirty = true;
  };
  const io = new IntersectionObserver((entries) => {
    visible = entries.some((e) => e.isIntersecting);
    if (visible && dirty) refresh();
  });
  io.observe(el);
  const onVisibility = (): void => {
    if (dirty) changed();
  };
  document.addEventListener('visibilitychange', onVisibility);
  el.replaceChildren(
    h('h2', null, 'Recommendation stats'),
    note,
    head,
    h(
      'div',
      { class: 'controls' },
      select(FILTERS, 'filter'),
      select(SORTS, 'sort'),
      h('input', {
        type: 'search',
        placeholder: 'search title/channel',
        oninput: (e) => ((q.search = (e.target as HTMLInputElement).value), refresh()),
      }),
    ),
    h(
      'table',
      null,
      h(
        'thead',
        null,
        h(
          'tr',
          null,
          ['', 'video', 'seen', 'opened', 'last', ''].map((t) => h('th', null, t)),
        ),
      ),
      body,
    ),
  );
  refresh();
  const offSettings = env.settings.subscribe(refresh);
  const offStats = onStatsChanged(changed);
  return () => {
    offSettings();
    offStats();
    io.disconnect();
    document.removeEventListener('visibilitychange', onVisibility);
    token = -1;
  };
}
