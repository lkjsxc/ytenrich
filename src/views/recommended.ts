// Recommended: videos YouTube recommended recently that you have not opened, dismissed or seen too often.
// Built from ytenrich's own record, so pages without a recommendation list (the Shorts player) get one too.
import { h, replaceChildren } from '../shared/h.ts';
import { onStatsChanged } from '../shared/protocol.ts';
import { patchSettings } from '../shared/settings.ts';
import type { StatsPage, StatsQuery, VideoStat } from '../shared/types.ts';
import { loadViewState, saveViewState } from '../shared/view-state.ts';
import { autoMore, grow, keyed } from './more.ts';
import { openVideo, videoUrl } from './open.ts';
import type { ViewEnv } from './registry.ts';
import { ago } from './stats/format.ts';
import { choice } from './stats/parts.ts';

const STEP = 40;
type Kind = StatsQuery['kind'];
const KINDS: readonly (readonly [Kind, string])[] = [
  ['video', 'Videos'],
  ['short', 'Shorts'],
  ['all', 'Both'],
];
const TITLES: Record<Kind, string> = {
  video: 'Recommended',
  short: 'Recommended Shorts',
  all: 'Recommended (all)',
};

export function mountRecommended(el: HTMLElement, env: ViewEnv): () => void {
  const q: StatsQuery = {
    sort: 'lastSeen',
    filter: 'pending',
    kind: 'video',
    channel: '',
    limit: STEP,
    search: '',
  };
  let token = 0;
  let sig = '';
  let visible = false;
  let dirty = false;
  const head = h('div');
  const grid = h('div');
  const cards = h('div');
  const foot = h('div');

  const images = (): boolean => !__FIREFOX__ && env.settings.get().thumbnailsEnabled;
  const card = (v: VideoStat): HTMLElement =>
    h(
      'a',
      {
        class: v.kind === 'short' ? 'rcard tall' : 'rcard',
        href: videoUrl(v.id, v.kind),
        title: v.title,
        onclick: (e) => openVideo(e as MouseEvent, v.id, v.kind, env),
      },
      images()
        ? h('img', {
            crossorigin: 'anonymous',
            referrerpolicy: 'no-referrer',
            src: `https://i.ytimg.com/vi/${v.id}/mqdefault.jpg`,
            loading: 'lazy',
            alt: '',
          })
        : null,
      h('b', null, v.title || v.id),
      h('span', { class: 'muted' }, v.channel),
      h('span', { class: 'muted' }, `shown ${v.seen}× · ${ago(v.lastSeen)} ago`),
    );

  const paintHead = (): void =>
    replaceChildren(
      head,
      h(
        'div',
        { class: 'stats-head' },
        h('h2', null, 'Recommended'),
        choice('seg-ctl', KINDS, q.kind, (kind) => {
          saveViewState(env.instance, { kind, title: TITLES[kind] });
          setKind(kind);
        }),
      ),
      !__FIREFOX__ && !env.settings.get().thumbnailsEnabled
        ? h(
            'p',
            { class: 'muted actions' },
            'Images are off. ',
            h(
              'button',
              {
                title: 'Loads thumbnails by requesting video IDs from YouTube’s image server',
                onclick: () => void patchSettings({ thumbnailsEnabled: true }),
              },
              'Show images',
            ),
          )
        : null,
    );

  const setKind = (kind: Kind): void => {
    Object.assign(q, { kind, limit: STEP });
    env.setTitle?.(TITLES[kind]);
    paintHead();
    refresh();
  };

  const paint = (page: StatsPage): void => {
    const img = images();
    cards.className = img ? 'rgrid' : 'rgrid text';
    cards.hidden = !page.rows.length;
    keyed(
      cards,
      page.rows.map((v) => [`${img}${v.id}${v.seen}${v.title}`, () => card(v)]),
    );
    replaceChildren(
      foot,
      page.rows.length
        ? null
        : h(
            'p',
            { class: 'muted' },
            env.settings.get().statsEnabled
              ? 'Nothing yet. Recommendations you are shown on YouTube collect here until you open them.'
              : 'This list is built from stats, which are off (see the Stats tab).',
          ),
      autoMore(page.more, q.limit, () => {
        q.limit = grow(q.limit, STEP);
        refresh();
      }),
    );
  };

  function refresh(): void {
    dirty = false;
    const my = ++token;
    env.call('query', q).then(
      (page) => {
        const s = env.settings.get();
        const next = JSON.stringify([page.rows.map((r) => r.id), page.more, s.thumbnailsEnabled]);
        if (my !== token || next === sig) return;
        sig = next;
        paint(page);
      },
      (e: unknown) => foot.replaceChildren(h('p', { class: 'error' }, String(e))),
    );
  }

  // The list reorders as recommendations arrive, so it only refreshes when the tile is (re)shown.
  const io = new IntersectionObserver((entries) => {
    visible = entries.some((e) => e.isIntersecting);
    if (visible && dirty) refresh();
  });
  io.observe(el);
  const offStats = onStatsChanged(() => {
    if (visible && sig !== '' && sig !== '[[],false,false]' && sig !== '[[],false,true]')
      dirty = true;
    else refresh();
  });
  const offSettings = env.settings.subscribe(() => {
    paintHead();
    refresh();
  });
  grid.append(cards, foot);
  el.replaceChildren(head, grid);
  paintHead();
  refresh();
  void loadViewState<{ kind: Kind }>(env.instance).then((state) => {
    if (token >= 0 && state.kind && state.kind !== q.kind && state.kind in TITLES)
      setKind(state.kind);
  });
  return () => {
    io.disconnect();
    offStats();
    offSettings();
    token = -1;
  };
}
