import type { PageKind, WmFamily } from '../shared/types.ts';
import { NEW_TAB } from './launcher.ts';
import { type LayoutNode, pane, split } from './layout.ts';

export const GUIDE_PX = 240; // YouTube's guide renderer width

/** Watch pages, home and the Shorts player have their own families; every other page is `browse`. */
export function familyOf(kind: PageKind): WmFamily {
  return kind === 'watch' || kind === 'shorts' || kind === 'home' ? kind : 'browse';
}

/** Default watch-page workspace: player over details | comments+chat | history, ytenrich's Recommended on the right
 * (YouTube's own list is the Videos view, via `+`),
 * with the playlist in front of them while one is playing (Shorts via `+`). */
export function watchPreset(): LayoutNode {
  return split(
    'row',
    [
      split(
        'col',
        [
          pane(['player']),
          split('row', [pane(['details']), pane(['comments', 'chat']), pane(['history'])]),
        ],
        [0.7, 0.3],
      ),
      pane(['playlist', 'recommended', 'stats', 'settings', 'log']),
    ],
    [0.66, 0.34],
  );
}

const withGuide = (tabs: string[], width: number): LayoutNode => {
  const f = Math.min(0.3, GUIDE_PX / Math.max(width, 800));
  return split('row', [pane(['guide']), pane(tabs)], [f, 1 - f]);
};
const OWN = ['stats', 'history', 'settings', 'log'];

/** Default for search/channel/feeds: guide on the left, the page itself with own views as tabs. */
export function browsePreset(width = globalThis.innerWidth || 1600): LayoutNode {
  return withGuide(['page', ...OWN], width);
}

/** Default for home: ytenrich's recommended Videos and Shorts (YouTube's own feed is the Default views, via `+`). */
export function homePreset(width = globalThis.innerWidth || 1600): LayoutNode {
  return withGuide(['recommended', 'recommended-shorts', ...OWN], width);
}

/** Default for the Shorts player (a narrow column): recently recommended videos beside it. */
export function shortsPreset(): LayoutNode {
  return split(
    'row',
    [pane(['page']), pane(['recommended', 'stats', 'history', 'settings', 'log'])],
    [0.5, 0.5],
  );
}

const BELOW = ['playlist', 'recommended', 'history', 'stats', 'settings', 'log'];
/** Watch workspaces 2–4: the player over the other tabs, and `tabs` at full height beside them. */
const beside = (tabs: string[]): LayoutNode =>
  split(
    'row',
    [
      split('col', [pane(['player']), pane(BELOW.filter((t) => !tabs.includes(t)))], [0.6, 0.4]),
      pane(tabs),
    ],
    [0.58, 0.42],
  );
/** Watch workspace 5: the player across the whole width, details and Recommended below it. */
const wide = (): LayoutNode =>
  split(
    'col',
    [pane(['player']), split('row', [pane(['details']), pane(['playlist', 'recommended'])])],
    [0.68, 0.32],
  );
/** Watch workspaces by number: 1 the default, 2 details, 3 comments, 4 history, 5 the wide player. */
const WATCH: readonly (() => LayoutNode)[] = [
  watchPreset,
  () => beside(['details']),
  () => beside(['comments', 'chat']),
  () => beside(['history']),
  wide,
];

const PRESETS: Record<WmFamily, () => LayoutNode> = {
  watch: watchPreset,
  browse: browsePreset,
  home: homePreset,
  shorts: shortsPreset,
};
/** Every family has `SPACES` workspaces (`wm/spaces.ts`). Those without a layout of their own start as a New tab page. */
export const presetOf = (family: WmFamily, space = 1): LayoutNode =>
  space === 1
    ? PRESETS[family]()
    : ((family === 'watch' ? WATCH[space - 1]?.() : undefined) ?? pane([NEW_TAB]));
