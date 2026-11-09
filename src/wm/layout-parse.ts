// Validates persisted (untrusted) layout JSON into a normalized tree; null when malformed.
import { type LayoutNode, normalize } from './layout.ts';

export function parseLayout(value: unknown): LayoutNode | null {
  if (typeof value !== 'object' || value === null) return null;
  const v = value as Record<string, unknown>;
  if (typeof v.id !== 'string') return null;
  const strings = (x: unknown): x is string[] =>
    Array.isArray(x) && x.every((t) => typeof t === 'string');
  if (v.type === 'pane' && strings(v.tabs))
    return {
      type: 'pane',
      id: v.id,
      tabs: v.tabs,
      active: typeof v.active === 'string' ? v.active : '',
    };
  if (v.type !== 'split' || (v.dir !== 'row' && v.dir !== 'col') || !Array.isArray(v.children))
    return null;
  const children = v.children.map(parseLayout);
  if (children.some((c) => !c)) return null;
  const sizes = Array.isArray(v.sizes) ? v.sizes.map(Number) : [];
  return normalize({
    type: 'split',
    id: v.id,
    dir: v.dir,
    children: children as LayoutNode[],
    sizes,
  });
}
