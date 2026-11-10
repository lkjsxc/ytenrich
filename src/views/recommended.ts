// Recommended: unopened videos YouTube showed you, ordered by your own record (`shared/recommend.ts`).
import { h, replaceChildren } from '../shared/h.ts';
import { onStatsChanged } from '../shared/protocol.ts';
import { patchSettings } from '../shared/settings.ts';
import type { ChannelStat, RecoMode, RecoPage, VideoStat } from '../shared/types.ts';
import { loadViewState, saveViewState } from '../shared/view-state.ts';
import { autoMore, grow, type Keyed, keyed } from './more.ts';
import { openVideo, videoUrl } from './open.ts';
import type { ViewEnv } from './registry.ts';
import { ago } from './stats/format.ts';
import { choice } from './stats/parts.ts';

const STEP = 40;
const MODES: readonly (readonly [RecoMode, string])[] = [
  ['video', 'Videos'],
  ['short', 'Shorts'],
  ['channel', 'Channels'],
];
const TITLES: Record<RecoMode, string> = {
  video: 'Recommended',
  short: 'Recommended Shorts',
  channel: 'Recommended channels',
};
/** Channel names are all the record has, so a channel opens as a channel search for its name. */
const channelUrl = (name: string): string =>
  `https://www.youtube.com/results?search_query=${encodeURIComponent(name)}&sp=EgIQAg%253D%253D`;

export function mountRecommended(el: HTMLElement, env: ViewEnv): () => void {
  let mode: RecoMode = 'video';
  let limit = STEP;
  let token = 0;
  let sig = '';
  let visible = false;
  let dirty = false;
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
      mode === 'channel' ? null : h('span', { class: 'muted' }, v.channel),
      h('span', { class: 'muted' }, `shown ${v.seen}× · ${ago(v.lastSeen)} ago`),
      h(
        'button',
        {
          class: 'rno',
          title:
            'Not interested: removes it from this list and ranks its channel lower. YouTube is not told.',
          onclick: dismiss,
        },
        '⊘',
      ),
    );
    return node;
  };
  const channelHead = (name: string, c: ChannelStat | undefined): HTMLElement =>
    h(
      'h3',
      { class: 'rchan' },
      h('a', { href: channelUrl(name), title: 'Find this channel on YouTube' }, name),
      h('span', { class: 'muted' }, c ? ` opened ${c.opened} · shown ${c.seen}×` : ''),
    );

  const paintHead = (): void =>
    replaceChildren(
      head,
      h(
        'div',
        { class: 'stats-head' },
        h('h2', null, 'Recommended'),
        choice('seg-ctl', MODES, mode, (next) => {
          saveViewState(env.instance, { kind: next, title: TITLES[next] });
          setMode(next);
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
  const setMode = (next: RecoMode): void => {
    mode = next;
    limit = STEP;
    env.setTitle?.(TITLES[next]);
    paintHead();
    refresh();
  };

  const paint = (page: RecoPage): void => {
    const img = images();
    const stats = new Map(page.channels.map((c) => [c.name, c])); // bound: the channels of one page
    cards.className = img ? 'rgrid' : 'rgrid text';
    cards.hidden = !page.rows.length;
    const items: Keyed[] = [];
    let channel = '';
    for (const v of page.rows) {
      if (mode === 'channel' && v.channel !== channel) {
        const c = stats.get(v.channel);
        items.push([`ch${v.channel}${c?.opened}${c?.seen}`, () => channelHead(v.channel, c)]);
      }
      channel = v.channel;
      items.push([`${mode}${img}${v.id}${v.seen}${v.title}`, () => card(v)]);
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
              ? 'Nothing yet. Recommendations you are shown on YouTube collect here until you open them.'
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
        const next = JSON.stringify([mode, page, env.settings.get().thumbnailsEnabled]);
        if (my !== token || next === sig) return;
        sig = next;
        paint(page);
      },
      (e: unknown) => foot.replaceChildren(h('p', { class: 'error' }, String(e))),
    );
  }

  // The order shifts as recommendations arrive, so a visible, filled list waits until it is shown again.
  const io = new IntersectionObserver((entries) => {
    visible = entries.some((e) => e.isIntersecting);
    if (visible && dirty) refresh();
  });
  io.observe(el);
  const offStats = onStatsChanged(() => {
    if (visible && cards.childElementCount) dirty = true;
    else refresh();
  });
  const offSettings = env.settings.subscribe(() => {
    paintHead();
    refresh();
  });
  el.replaceChildren(head, cards, foot);
  paintHead();
  refresh();
  void loadViewState<{ kind: RecoMode }>(env.instance).then((state) => {
    if (token >= 0 && state.kind && state.kind !== mode && state.kind in TITLES)
      setMode(state.kind);
  });
  return () => {
    io.disconnect();
    offStats();
    offSettings();
    token = -1;
  };
}
