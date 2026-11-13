// Recommended: unopened videos YouTube showed you, ordered by your own record (`shared/recommend.ts`).
import { h, replaceChildren } from '../shared/h.ts';
import { dismissIcon } from '../shared/icons.ts';
import { onStatsChanged } from '../shared/protocol.ts';
import type { ChannelStat, RecoMode, RecoPage, VideoStat } from '../shared/types.ts';
import { loadViewState, saveViewState } from '../shared/view-state.ts';
import { autoMore, grow, type Keyed, keyed } from './more.ts';
import { openVideo, videoUrl } from './open.ts';
import { recoNotes } from './reco-notes.ts';
import type { ViewEnv } from './registry.ts';
import { shownLine, since } from './stats/format.ts';
import { choice } from './stats/parts.ts';

const STEP = 40;
const SETTLE_MS = 3000; // after a navigation the list still takes in what arrives (the opened video, new offers)
const IMG = { crossorigin: 'anonymous', referrerpolicy: 'no-referrer', loading: 'lazy', alt: '' };
const NO_HINT = 'Not interested: hides it here and ranks its channel lower. YouTube is not told.';
const MODES: readonly (readonly [RecoMode, string])[] = [
  ['video', 'Videos'],
  ['short', 'Shorts'],
  ['channel', 'Channels'],
];
const LABELS = Object.fromEntries(MODES) as Record<RecoMode, string>; // a tab is named after its mode
const titleOf = (m: RecoMode): string => LABELS[m];
/** Channel and upload age, e.g. "Lofi Girl · 3mo ago" (the channel is left out under a channel heading). */
const byline = (v: VideoStat, bare: boolean): string =>
  [bare ? '' : v.channel, v.published ? since(v.published) : ''].filter(Boolean).join(' · ');
/** Channel names are all the record has, so a channel opens as a channel search for its name. */
const channelUrl = (name: string): string =>
  `https://www.youtube.com/results?search_query=${encodeURIComponent(name)}&sp=EgIQAg%253D%253D`;

export function mountRecommended(el: HTMLElement, env: ViewEnv, initial: RecoMode): () => void {
  let mode: RecoMode = initial;
  let limit = STEP;
  let token = 0;
  let sig = '';
  let visible = false;
  let dirty = false;
  let settleUntil = 0;
  const head = h('div');
  const cards = h('div');
  const foot = h('div');
  const images = (): boolean => !__FIREFOX__ && env.settings.get().thumbnailsEnabled;

  const card = (v: VideoStat): HTMLElement => {
    const dismiss = (e: Event): void => {
      e.preventDefault();
      e.stopPropagation();
      node.remove();
      void env.call('dismissed', { id: v.id });
    };
    const node = h(
      'a',
      {
        class: v.kind === 'short' ? 'rcard tall' : 'rcard',
        href: videoUrl(v.id, v.kind),
        title: v.title,
        onclick: (e) => openVideo(e as MouseEvent, v.id, v.kind, env),
      },
      images() ? h('img', { ...IMG, src: `https://i.ytimg.com/vi/${v.id}/mqdefault.jpg` }) : null,
      h(
        'div',
        { class: 'rrow' },
        h(
          'div',
          { class: 'rtext' },
          h('b', null, v.title || v.id),
          h('span', { class: 'muted' }, byline(v, mode === 'channel')),
          env.settings.get().recoMeta ? h('span', { class: 'muted' }, shownLine(v)) : null,
        ),
        h('button', { class: 'rno', title: NO_HINT, onclick: dismiss }, dismissIcon()),
      ),
    );
    return node;
  };
  const channelHead = (name: string, c: ChannelStat | undefined): HTMLElement =>
    h(
      'h3',
      { class: 'rchan' },
      images() && c?.icon ? h('img', { ...IMG, src: c.icon }) : null,
      h('a', { href: channelUrl(name), title: 'Find this channel on YouTube' }, name),
      env.settings.get().recoMeta && c
        ? h('span', { class: 'muted' }, `opened ${c.opened} · shown ${c.seen}×`)
        : null,
    );
  const paintHead = (): void =>
    replaceChildren(
      head,
      h(
        'div',
        { class: 'stats-head' },
        h('h2', null, 'Recommended'),
        choice('seg-ctl', MODES, mode, (next) => {
          saveViewState(env.instance, { kind: next, title: titleOf(next) });
          setMode(next);
        }),
      ),
      recoNotes(env.settings.get()),
    );
  const setMode = (next: RecoMode): void => {
    mode = next;
    limit = STEP;
    env.setTitle?.(titleOf(next));
    paintHead();
    refresh();
  };

  const paint = (page: RecoPage): void => {
    const img = images();
    const meta = env.settings.get().recoMeta;
    const stats = new Map(page.channels.map((c) => [c.name, c])); // bound: the channels of one page
    cards.className = img ? 'rgrid' : 'rgrid text';
    cards.hidden = !page.rows.length;
    const items: Keyed[] = [];
    let channel = '';
    for (const v of page.rows) {
      if (mode === 'channel' && v.channel !== channel) {
        const c = stats.get(v.channel);
        items.push([
          `ch${meta}${img}${v.channel}${c?.icon}${c?.opened}${c?.seen}`,
          () => channelHead(v.channel, c),
        ]);
      }
      channel = v.channel;
      items.push([`${mode}${meta}${img}${v.id}${v.seen}${v.title}${v.published}`, () => card(v)]);
    }
    keyed(cards, items);
    replaceChildren(
      foot,
      page.rows.length
        ? null
        : h(
            'p',
            { class: 'muted' },
            env.settings.get().statsEnabled
              ? 'Nothing yet. Recommendations YouTube puts on your pages collect here until you open them.'
              : 'This list is built from stats, which are off (see the Stats tab).',
          ),
      autoMore(page.more, limit, () => {
        limit = grow(limit, STEP);
        refresh();
      }),
    );
  };

  function refresh(): void {
    dirty = false;
    const my = ++token;
    env.call('recommend', { mode, limit }).then(
      (page) => {
        const next = JSON.stringify([mode, page, images(), env.settings.get().recoMeta]);
        if (my !== token || next === sig) return;
        sig = next;
        paint(page);
      },
      (e: unknown) => foot.replaceChildren(h('p', { class: 'error' }, String(e))),
    );
  }

  // One list per page view: every navigation reloads it from the top. After it settles the order holds while it
  // is on screen (it shifts as recommendations arrive) and catches up when it is shown again.
  const io = new IntersectionObserver((entries) => {
    visible = entries.some((e) => e.isIntersecting);
    if (visible && dirty) refresh();
  });
  io.observe(el);
  const offPage = env.page?.subscribe(() => {
    settleUntil = Date.now() + SETTLE_MS;
    limit = STEP;
    el.closest('.body')?.scrollTo({ top: 0 });
    refresh();
  });
  const offStats = onStatsChanged(() => {
    if (visible && cards.childElementCount && Date.now() > settleUntil) dirty = true;
    else refresh();
  });
  const offSettings = env.settings.subscribe(() => {
    paintHead();
    refresh();
  });
  el.replaceChildren(head, cards, foot);
  paintHead();
  refresh();
  void loadViewState<{ kind: RecoMode; title: string }>(env.instance).then((state) => {
    if (token < 0) return;
    const kind = state.kind && state.kind in LABELS ? state.kind : mode;
    if (state.title !== titleOf(kind)) saveViewState(env.instance, { kind, title: titleOf(kind) });
    if (kind !== mode) setMode(kind);
    else env.setTitle?.(titleOf(kind));
  });
  return () => {
    io.disconnect();
    offStats();
    offPage?.();
    offSettings();
    token = -1;
  };
}
