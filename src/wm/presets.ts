import type { PageKind, WmFamily } from '../shared/types.ts';
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
        [0.62, 0.38],
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

const PRESETS: Record<WmFamily, () => LayoutNode> = {
  watch: watchPreset,
  browse: browsePreset,
  home: homePreset,
  shorts: shortsPreset,
};
export const presetOf = (family: WmFamily): LayoutNode => PRESETS[family]();
