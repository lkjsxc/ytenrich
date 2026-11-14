// Cards of the Recommended list: one per video (or Mix), and a heading per channel in grouped lists.
import { h } from '../shared/h.ts';
import { dismissIcon } from '../shared/icons.ts';
import type { ChannelStat, VideoStat } from '../shared/types.ts';
import { kindBadge, openVideo, thumbUrl, videoUrl } from './open.ts';
import type { ViewEnv } from './registry.ts';
import { shownLine, since } from './stats/format.ts';

const IMG = { crossorigin: 'anonymous', referrerpolicy: 'no-referrer', loading: 'lazy', alt: '' };
const NO_HINT = 'Not interested: hides it here and ranks its channel lower. YouTube is not told.';

export const images = (env: ViewEnv): boolean =>
  !__FIREFOX__ && env.settings.get().thumbnailsEnabled;

/** Channel, views and upload age, e.g. "Lofi Girl · 1.2M views · 3mo ago" (no channel where the list names it). */
const byline = (v: VideoStat, bare: boolean): string =>
  [
    bare ? '' : v.channel,
    v.kind === 'mix' ? 'Mix list' : '',
    v.views ?? '',
    v.published ? since(v.published) : '',
  ]
    .filter(Boolean)
    .join(' · ');

/** Channel names are all the record has, so a channel opens as a channel search for its name. */
const channelUrl = (name: string): string =>
  `https://www.youtube.com/results?search_query=${encodeURIComponent(name)}&sp=EgIQAg%253D%253D`;

export function videoCard(v: VideoStat, env: ViewEnv, bare: boolean): HTMLElement {
  const dismiss = (e: Event): void => {
    e.preventDefault();
    e.stopPropagation();
    node.remove();
    void env.call('dismissed', { id: v.id });
  };
  const opened = v.opened ? h('span', { class: 'badge' }, 'opened') : null;
  const node = h(
    'a',
    {
      class: v.kind === 'short' ? 'rcard tall' : 'rcard',
      href: videoUrl(v),
      title: v.title,
      onclick: (e) => openVideo(e as MouseEvent, v, env),
    },
    images(env) ? h('img', { ...IMG, src: thumbUrl(v, 'mqdefault') }) : null,
    h(
      'div',
      { class: 'rrow' },
      h(
        'div',
        { class: 'rtext' },
        h('b', null, v.title || v.id),
        h('span', { class: 'muted' }, byline(v, bare), opened),
        env.settings.get().recoMeta ? h('span', { class: 'muted' }, shownLine(v)) : null,
      ),
      v.opened
        ? null
        : h('button', { class: 'rno', title: NO_HINT, onclick: dismiss }, dismissIcon()),
    ),
  );
  if (!images(env) && kindBadge(v) && v.kind !== 'mix')
    node.querySelector('b')?.append(h('span', { class: 'badge' }, kindBadge(v)));
  return node;
}

export function channelHead(name: string, c: ChannelStat | undefined, env: ViewEnv): HTMLElement {
  return h(
    'h3',
    { class: 'rchan' },
    images(env) && c?.icon ? h('img', { ...IMG, src: c.icon }) : null,
    h('a', { href: channelUrl(name), title: 'Find this channel on YouTube' }, name),
    env.settings.get().recoMeta && c
      ? h('span', { class: 'muted' }, `opened ${c.opened} · shown ${c.seen}×`)
      : null,
  );
}
