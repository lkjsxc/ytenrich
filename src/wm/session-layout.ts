// A playback session keeps the watch workspace geometry while another YouTube page occupies a companion pane.
import type { LayoutNode, PaneNode } from './layout.ts';

export type SessionLayout = {
  readonly layout: LayoutNode;
  /** False without a player and a separate pane: callers must keep ordinary navigation in that case. */
  readonly canBrowse: boolean;
};

/** Respect an existing Page placement, then prefer recommendations, then the largest remaining pane by area. */
function pagePane(root: LayoutNode): PaneNode | undefined {
  let player = false;
  let chosen: { pane: PaneNode; priority: number; area: number } | undefined;
  const visit = (node: LayoutNode, area: number): void => {
    if (node.type === 'split') {
      node.children.forEach((child, i) => visit(child, area * (node.sizes[i] ?? 0)));
      return;
    }
    if (node.tabs.includes('player')) {
      player = true;
      return;
    }
    const recommendations = node.tabs.some((tab) =>
      ['recommended', 'videos'].includes(tab.split('~')[0] ?? tab),
    );
    const priority = node.tabs.includes('page') ? 2 : recommendations ? 1 : 0;
    if (
      !chosen ||
      priority > chosen.priority ||
      (priority === chosen.priority && area > chosen.area)
    )
      chosen = { pane: node, priority, area };
  };
  visit(root, 1);
  return player ? chosen?.pane : undefined;
}

/** Transient projection only: never save this result over the watch layout. On watch, returns the original root.
 * Browsing adds/activates Page in another pane, moving it out of the player pane if needed. Pane identities,
 * split structure and sizes stay unchanged; a player-only layout explicitly cannot browse alongside playback. */
export function projectSessionLayout(
  root: LayoutNode,
  browsing: boolean,
  available = root,
): SessionLayout {
  const target = pagePane(available);
  if (!browsing || !target) return { layout: root, canBrowse: Boolean(target) };
  const project = (node: LayoutNode): LayoutNode => {
    if (node.type === 'split') {
      const children = node.children.map(project);
      return children.every((child, i) => child === node.children[i])
        ? node
        : { ...node, children };
    }
    if (node.id === target.id) {
      if (node.tabs.includes('page') && node.active === 'page') return node;
      const tabs = node.tabs.includes('page') ? node.tabs : [...node.tabs, 'page'];
      return { ...node, tabs, active: 'page' };
    }
    if (!node.tabs.includes('page')) return node;
    return {
      ...node,
      tabs: node.tabs.filter((tab) => tab !== 'page'),
      active: node.active === 'page' ? 'player' : node.active,
    };
  };
  return { layout: project(root), canBrowse: true };
}
