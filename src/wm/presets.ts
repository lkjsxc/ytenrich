import type { PageKind, WmFamily } from '../shared/types.ts';
import { type LayoutNode, pane, split } from './layout.ts';

export const GUIDE_PX = 240; // YouTube's guide renderer width

/** Watch pages have their own family; every other page (Shorts included) is projected whole as `page`. */
export function familyOf(kind: PageKind): WmFamily {
  return kind === 'watch' ? 'watch' : 'browse';
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

export const presetOf = (family: WmFamily): LayoutNode =>
  family === 'watch' ? watchPreset() : browsePreset();
