// Native controls that focus or toggle WM views.
import { onGuideButton } from '../youtube/guide.ts';
import { onChaptersOpen } from '../youtube/slots.ts';
import * as L from './layout.ts';
import { addEdge } from './layout-edge.ts';
import { GUIDE_PX } from './presets.ts';

export function nativeActions(
  root: () => L.LayoutNode,
  set: (next: L.LayoutNode | null) => void,
  kinds: ReadonlySet<string>,
): () => void {
  const guide = onGuideButton(() => {
    const tree = root();
    const p = L.paneOfView(tree, 'guide');
    if (!p) set(addEdge(tree, 'guide', 'left', GUIDE_PX / Math.max(innerWidth, 1)));
    else if (p.active !== 'guide') set(L.activate(tree, 'guide'));
    else set(L.removeView(tree, 'guide'));
  });
  const chapters = onChaptersOpen(() => {
    const tree = root();
    const p = L.paneOfView(tree, 'chapters') ?? L.paneOfView(tree, 'details');
    if (p && kinds.has('chapters'))
      set(
        p.tabs.includes('chapters')
          ? L.activate(tree, 'chapters')
          : L.addView(tree, p.id, 'chapters', 'center'),
      );
  });
  return () => {
    guide();
    chapters();
  };
}
