import type { PageKind, WmFamily } from '../shared/types.ts';
import { type LayoutNode, pane, split } from './layout.ts';

export const GUIDE_PX = 240; // YouTube's guide renderer width

/** Watch pages and the Shorts player have their own families; every other page is `browse`. */
export function familyOf(kind: PageKind): WmFamily {
  return kind === 'watch' || kind === 'shorts' ? kind : 'browse';
}

/** Default watch-page workspace: player over details | comments+chat, recommendations on the right (Shorts via `+`). */
export function watchPreset(): LayoutNode {
  return split(
    'row',
    [
      split(
        'col',
        [pane(['player']), split('row', [pane(['details']), pane(['comments', 'chat'])])],
        [0.62, 0.38],
      ),
      pane(['videos', 'stats', 'history', 'settings', 'log']),
    ],
    [0.66, 0.34],
  );
}

/** Default for home/search/channel/feeds: guide on the left, the page itself with own views as tabs. */
export function browsePreset(width = globalThis.innerWidth || 1600): LayoutNode {
  const f = Math.min(0.3, GUIDE_PX / Math.max(width, 800));
  return split(
    'row',
    [pane(['guide']), pane(['page', 'stats', 'history', 'settings', 'log'])],
    [f, 1 - f],
  );
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
  shorts: shortsPreset,
};
export const presetOf = (family: WmFamily): LayoutNode => PRESETS[family]();
