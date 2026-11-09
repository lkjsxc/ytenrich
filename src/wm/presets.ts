import { type LayoutNode, pane, split } from './layout.ts';

/** Default watch-page workspace: player over details/comments, recommendations on the right. */
export function watchPreset(): LayoutNode {
  return split(
    'row',
    [
      split('col', [pane(['player']), pane(['details', 'comments'])], [0.62, 0.38]),
      pane(['videos', 'shorts', 'stats', 'settings', 'log']),
    ],
    [0.66, 0.34],
  );
}
