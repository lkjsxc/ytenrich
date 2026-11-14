// View registry: every tab a WM pane (or the options page) can show.

import type { Page } from '../content/route-signal.ts';
import type { Scanner } from '../content/scanner.ts';
import type { Log } from '../shared/log.ts';
import type { call } from '../shared/protocol.ts';
import type { Settings } from '../shared/settings.ts';
import type { Disposer, Signal } from '../shared/signal.ts';
import type { WmFamily } from '../shared/types.ts';
import type { NativeSlot } from '../youtube/selectors.ts';
import { mountHistory } from './history.ts';
import { mountLog } from './log.ts';
import { recoSpec } from './reco-spec.ts';
import { mountRecommended } from './recommended.ts';
import { mountSettings } from './settings.ts';
import { mountStats } from './stats/index.ts';

export type ViewEnv = {
  readonly call: typeof call;
  readonly log: Log;
  readonly settings: Signal<Settings>;
  /** Present inside YouTube only (the options page has no page items). */
  readonly scanner?: Scanner;
  /** The page being shown, inside YouTube only: it changes on every in-app navigation. */
  readonly page?: Pick<Signal<Page>, 'get' | 'subscribe'>;
  /** The channel the page is about ('' if none), inside YouTube only. */
  readonly channel?: Pick<Signal<string>, 'get' | 'subscribe'>;
  /** Unique name of this tab (`<host>:<view id>`): the key of its saved state (`shared/view-state.ts`). */
  readonly instance: string;
  /** Renames this tab (the WM strip only). */
  readonly setTitle?: (title: string) => void;
};
export type ViewDef = {
  readonly id: string;
  readonly title: string;
  /** One line for the New tab page. */
  readonly hint: string;
  /** Native YouTube element projected into the pane (content script only). */
  readonly slot?: NativeSlot;
  /** Shows only one part of the slot's element (CSS on `[ytenrich-part]`); views of one slot take turns. */
  readonly part?: string;
  /** The tab exists only while the slot's element does (the playlist panel). */
  readonly optional?: boolean;
  /** Layout families the view exists in (default: all). */
  readonly families?: readonly WmFamily[];
  /** Own view rendered by ytenrich into the pane body. */
  readonly mount?: (el: HTMLElement, env: ViewEnv) => Disposer;
};

const W: readonly WmFamily[] = ['watch'];

export const VIEWS: readonly ViewDef[] = [
  { id: 'guide', title: 'Guide', hint: 'YouTube’s navigation menu', slot: 'guide' },
  {
    id: 'page',
    title: 'Page',
    hint: 'The YouTube page itself',
    slot: 'page',
    families: ['browse', 'channel', 'shorts'],
  },
  {
    id: 'home-videos',
    title: 'Default · Videos',
    hint: 'The home feed without Shorts',
    slot: 'page',
    part: 'videos',
    families: ['home'],
  },
  {
    id: 'home-shorts',
    title: 'Default · Shorts',
    hint: 'Only the Shorts of the home feed',
    slot: 'page',
    part: 'shorts',
    families: ['home'],
  },
  { id: 'player', title: 'Player', hint: 'The video player', slot: 'player', families: W },
  {
    id: 'details',
    title: 'Details',
    hint: 'Title, channel, description',
    slot: 'details',
    families: W,
  },
  {
    id: 'chapters',
    title: 'Chapters',
    hint: 'Chapters of this video, shown when it has some: a click jumps there',
    slot: 'chapters',
    optional: true,
    families: W,
  },
  {
    id: 'comments',
    title: 'Comments',
    hint: 'Comments on this video',
    slot: 'comments',
    families: W,
  },
  { id: 'chat', title: 'Chat', hint: 'Live chat or chat replay', slot: 'chat', families: W },
  {
    id: 'videos',
    title: 'Default · Videos',
    hint: 'YouTube’s recommendations for this video',
    slot: 'videos',
    families: W,
  },
  {
    id: 'playlist',
    title: 'Playlist',
    hint: 'The playlist, mix or queue being played (shown only when there is one)',
    slot: 'playlist',
    optional: true,
    families: W,
  },
  {
    id: 'shorts',
    title: 'Default · Shorts',
    hint: 'The Shorts shelf of the recommendations',
    slot: 'shorts',
    families: W,
  },
  // ytenrich's own recommendations take the plain names; YouTube's own lists are the "Default · …" views.
  {
    id: 'recommended',
    title: 'Videos',
    hint: 'Recommended videos you have not opened, in your order (▶ sets what it lists)',
    mount: (el, env) => mountRecommended(el, env, recoSpec()),
  },
  {
    id: 'recommended-shorts',
    title: 'Shorts',
    hint: 'Recommended Shorts you have not opened',
    mount: (el, env) => mountRecommended(el, env, recoSpec({ kind: 'short' })),
  },
  {
    id: 'recommended-mixes',
    title: 'Mix lists',
    hint: 'Recommended Mix lists (YouTube’s endless radio lists) you have not opened',
    mount: (el, env) => mountRecommended(el, env, recoSpec({ kind: 'mix' })),
  },
  {
    id: 'recommended-channels',
    title: 'Channels',
    hint: 'Recommendations grouped by the channels you like most',
    mount: (el, env) => mountRecommended(el, env, recoSpec({ group: true })),
  },
  {
    id: 'channel-videos',
    title: 'This channel',
    hint: 'Unopened videos of the channel of this page: the video’s owner, or the channel page',
    mount: (el, env) => mountRecommended(el, env, recoSpec({ scope: 'page' })),
  },
  {
    id: 'stats',
    title: 'Stats',
    hint: 'What YouTube shows you and what you open',
    mount: mountStats,
  },
  { id: 'history', title: 'History', hint: 'Videos you opened, by day', mount: mountHistory },
  { id: 'settings', title: 'Settings', hint: 'ytenrich options', mount: mountSettings },
  { id: 'log', title: 'Log', hint: 'ytenrich diagnostics', mount: mountLog },
];

/** Tab ids are `<view id>` or `<view id>~<n>`: own views can be open several times, native ones once. */
export const kindOf = (tab: string): string => tab.split('~')[0] ?? tab;
const BY_ID: ReadonlyMap<string, ViewDef> = new Map(VIEWS.map((v) => [v.id, v]));
export const viewOf = (tab: string): ViewDef | undefined => BY_ID.get(kindOf(tab));
/** First free tab id for another instance of `kind`. */
export function freshTab(kind: string, used: ReadonlySet<string>): string {
  if (!used.has(kind)) return kind;
  for (let n = 2; ; n++) if (!used.has(`${kind}~${n}`)) return `${kind}~${n}`;
}
export const viewsOf = (family: WmFamily): ViewDef[] =>
  VIEWS.filter((v) => !v.families || v.families.includes(family));
