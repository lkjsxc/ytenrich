// Page temporarily joins a companion pane. Saving a layout keeps user edits, without saving that temporary tab.
import type { Runtime } from '../content/runtime.ts';
import type { WmFamily } from '../shared/types.ts';
import * as L from './layout.ts';
import { projectSessionLayout } from './session-layout.ts';

export function createSessionViews(rt: Runtime, family: WmFamily) {
  let browsing = false;
  let nav = -1;
  let added = false;
  let returnView: string | undefined;
  let origin: { pane: string; index: number; active: string } | undefined; // bound: the one Page tab
  const reset = (): void => {
    browsing = added = false;
    nav = -1;
    returnView = undefined;
    origin = undefined;
  };
  const saved = (root: L.LayoutNode): L.LayoutNode => {
    const active = L.paneOfView(root, 'page')?.active === 'page';
    let next = added || origin ? (L.removeView(root, 'page') ?? root) : root;
    if (origin && L.panes(next).some((p) => p.id === origin?.pane)) {
      next = L.moveView(next, 'page', origin.pane, 'center', origin.index);
      next = L.activate(next, origin.active);
    }
    if (active && returnView && L.paneOfView(next, returnView)) next = L.activate(next, returnView);
    return next;
  };
  return {
    saved,
    reset,
    navigate(root: L.LayoutNode, visible: L.LayoutNode): L.LayoutNode {
      if (family !== 'watch') return root;
      const page = rt.page.get();
      const next = Boolean(rt.playback.kept.get()) && page.kind !== 'watch';
      if (!next) {
        if (!browsing) return root;
        const restored = saved(root);
        reset();
        return restored;
      }
      if (browsing && page.nav === nav) return root;
      const projected = projectSessionLayout(root, true, visible);
      if (!projected.canBrowse) return root;
      if (!browsing) {
        const pane = L.paneOfView(projected.layout, 'page');
        returnView = L.panes(root).find((p) => p.id === pane?.id)?.active;
        const old = L.paneOfView(root, 'page');
        added = !old;
        if (old?.tabs.includes('player'))
          origin = { pane: old.id, index: old.tabs.indexOf('page'), active: old.active };
      }
      browsing = true;
      nav = page.nav;
      return projected.layout;
    },
    allow(visible: L.LayoutNode): void {
      rt.playback.allow(
        family === 'watch' && projectSessionLayout(visible, false).canBrowse,
        Boolean(L.paneOfView(visible, 'player')),
      );
    },
  };
}
