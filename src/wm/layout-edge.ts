import {
  type LayoutNode,
  normalize,
  pane,
  removeView,
  split,
  type ViewId,
  type Zone,
} from './layout.ts';

/** Puts `view` in a new pane along an edge of the whole layout (e.g. the guide on the far left). */
export function addEdge(
  root: LayoutNode,
  view: ViewId,
  zone: Exclude<Zone, 'center'>,
  size: number,
): LayoutNode {
  const base = removeView(root, view);
  const fresh = pane([view]);
  if (!base) return fresh;
  const f = Math.min(0.9, Math.max(0.05, size));
  const before = zone === 'left' || zone === 'top';
  const dir = zone === 'left' || zone === 'right' ? 'row' : 'col';
  const node = before
    ? split(dir, [fresh, base], [f, 1 - f])
    : split(dir, [base, fresh], [1 - f, f]);
  return normalize(node) ?? root;
}
