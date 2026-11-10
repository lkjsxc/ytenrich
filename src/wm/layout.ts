// Pure layout tree (ported from lkjstr workspace/layout-tree). Tabs are view ids; each view appears at most once.
export type ViewId = string;
export type Dir = 'row' | 'col';
export type Zone = 'center' | 'left' | 'right' | 'top' | 'bottom';
export type PaneNode = {
  readonly type: 'pane';
  readonly id: string;
  readonly tabs: readonly ViewId[];
  readonly active: ViewId;
};
export type SplitNode = {
  readonly type: 'split';
  readonly id: string;
  readonly dir: Dir;
  readonly children: readonly LayoutNode[];
  readonly sizes: readonly number[];
};
export type LayoutNode = PaneNode | SplitNode;

const uid = (): string => crypto.randomUUID().slice(0, 8);

export function pane(tabs: readonly ViewId[], active = tabs[0] ?? ''): PaneNode {
  return { type: 'pane', id: uid(), tabs, active };
}

export function split(
  dir: Dir,
  children: readonly LayoutNode[],
  sizes?: readonly number[],
): SplitNode {
  return {
    type: 'split',
    id: uid(),
    dir,
    children,
    sizes: sizes ?? children.map(() => 1 / children.length),
  };
}

export function panes(root: LayoutNode): PaneNode[] {
  return root.type === 'pane' ? [root] : root.children.flatMap(panes);
}

export function paneOfView(root: LayoutNode, view: ViewId): PaneNode | undefined {
  return panes(root).find((p) => p.tabs.includes(view));
}

function mapPanes(root: LayoutNode, fn: (p: PaneNode) => LayoutNode | null): LayoutNode | null {
  if (root.type === 'pane') return fn(root);
  const children = root.children.map((c) => mapPanes(c, fn));
  return { ...root, children: children as LayoutNode[] }; // nulls removed by normalize
}

const normSizes = (sizes: readonly number[]): number[] => {
  const valid = sizes.map((s) => (Number.isFinite(s) && s > 0 ? s : 0));
  const sum = valid.reduce((a, b) => a + b, 0);
  return sum > 0 && valid.every((s) => s > 0)
    ? valid.map((s) => s / sum)
    : valid.map(() => 1 / valid.length);
};

/** Removes empty panes/splits, flattens same-direction nesting, fixes sizes and active tabs. */
export function normalize(node: LayoutNode | null): LayoutNode | null {
  if (!node) return null;
  if (node.type === 'pane') {
    const tabs = [...new Set(node.tabs)];
    if (!tabs.length) return null;
    return {
      ...node,
      tabs,
      active: tabs.includes(node.active) ? node.active : (tabs[0] as ViewId),
    };
  }
  const kids: LayoutNode[] = [];
  const sizes: number[] = [];
  node.children.forEach((child, i) => {
    const n = normalize(child);
    const size = node.sizes[i] ?? 0;
    if (!n) return;
    if (n.type === 'split' && n.dir === node.dir) {
      n.children.forEach((c, j) => kids.push(c) && sizes.push(size * (n.sizes[j] ?? 0)));
    } else kids.push(n) && sizes.push(size);
  });
  if (!kids.length) return null;
  if (kids.length === 1) return kids[0] as LayoutNode;
  return { ...node, children: kids, sizes: normSizes(sizes) };
}

/** Keep only known views, each at most once (first occurrence wins). */
export function retainViews(root: LayoutNode, known: ReadonlySet<ViewId>): LayoutNode | null {
  const used = new Set<ViewId>();
  return normalize(
    mapPanes(root, (p) => {
      const tabs = p.tabs.filter((t) => known.has(t) && !used.has(t) && used.add(t));
      return { ...p, tabs };
    }),
  );
}

export function activate(root: LayoutNode, view: ViewId): LayoutNode {
  return mapPanes(root, (p) => (p.tabs.includes(view) ? { ...p, active: view } : p)) as LayoutNode;
}

export function removeView(root: LayoutNode, view: ViewId): LayoutNode | null {
  return normalize(mapPanes(root, (p) => ({ ...p, tabs: p.tabs.filter((t) => t !== view) })));
}

/** A joining pane takes 1/n, given up by the siblings at least that large: 1:1 → 1:1:1, the guide keeps its size. */
function insertEqual(s: SplitNode, at: number, fresh: PaneNode): SplitNode {
  const share = 1 / (s.children.length + 1);
  const donors = s.sizes.reduce((sum, z) => sum + (z >= share ? z : 0), 0);
  const sizes = s.sizes.map((z) => (z >= share ? z - (share * z) / donors : z));
  return {
    ...s,
    children: [...s.children.slice(0, at), fresh, ...s.children.slice(at)],
    sizes: [...sizes.slice(0, at), share, ...sizes.slice(at)],
  };
}

function splitPane(node: LayoutNode, paneId: string, fresh: PaneNode, zone: Zone): LayoutNode {
  const dir: Dir = zone === 'left' || zone === 'right' ? 'row' : 'col';
  const after = zone === 'right' || zone === 'bottom' ? 1 : 0;
  if (node.type === 'pane')
    return node.id !== paneId ? node : split(dir, after ? [node, fresh] : [fresh, node]);
  const i = node.children.findIndex((c) => c.type === 'pane' && c.id === paneId);
  if (i >= 0 && node.dir === dir) return insertEqual(node, i + after, fresh);
  return { ...node, children: node.children.map((c) => splitPane(c, paneId, fresh, zone)) };
}

export function addView(root: LayoutNode, paneId: string, view: ViewId, zone: Zone): LayoutNode {
  if (zone !== 'center') return normalize(splitPane(root, paneId, pane([view]), zone)) ?? root;
  const add = (p: PaneNode): PaneNode =>
    p.id === paneId ? { ...p, tabs: [...p.tabs, view], active: view } : p;
  return normalize(mapPanes(root, add)) ?? root;
}

/** Moves a tab. `index` (center only) inserts at that position of the target strip, enabling reorder. */
export function moveView(
  root: LayoutNode,
  view: ViewId,
  paneId: string,
  zone: Zone,
  index?: number,
): LayoutNode {
  const src = paneOfView(root, view);
  if (zone === 'center' && index !== undefined) {
    const target = panes(root).find((p) => p.id === paneId);
    if (!target) return root;
    const from = target.tabs.indexOf(view);
    const at = from >= 0 && from < index ? index - 1 : index;
    const next = mapPanes(root, (p) => {
      const tabs = p.tabs.filter((t) => t !== view);
      if (p.id !== paneId) return { ...p, tabs };
      tabs.splice(Math.max(0, Math.min(at, tabs.length)), 0, view);
      return { ...p, tabs, active: view };
    });
    return normalize(next) ?? root;
  }
  if (src?.id === paneId && (zone === 'center' || src.tabs.length === 1))
    return activate(root, view);
  const removed = src ? removeView(root, view) : root;
  if (!removed || !panes(removed).some((p) => p.id === paneId)) return root;
  return addView(removed, paneId, view, zone);
}

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

export function resize(root: LayoutNode, splitId: string, sizes: readonly number[]): LayoutNode {
  if (root.type === 'pane') return root;
  if (root.id === splitId && sizes.length === root.children.length)
    return { ...root, sizes: normSizes(sizes) };
  return { ...root, children: root.children.map((c) => resize(c, splitId, sizes)) };
}

export function closePane(root: LayoutNode, paneId: string): LayoutNode | null {
  return normalize(mapPanes(root, (p) => (p.id === paneId ? null : p)));
}

export function views(root: LayoutNode): ViewId[] {
  return panes(root).flatMap((p) => p.tabs);
}
