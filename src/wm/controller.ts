// WM controller for one page kind: layout state, persistence, rendering, own-view mounts, projection.
import type { Runtime } from '../content/runtime.ts';
import { patchSettings } from '../shared/settings.ts';
import type { Disposer } from '../shared/signal.ts';
import { VIEW_BY_ID, VIEWS, type ViewEnv } from '../views/registry.ts';
import { mastheadHeight } from '../youtube/slots.ts';
import { createHost } from './host.ts';
import * as L from './layout.ts';
import { openMenu } from './menus.ts';
import { watchPreset } from './presets.ts';
import { createProjector } from './projector.ts';
import { type Rendered, renderLayout } from './render.ts';
import { startResize } from './resize.ts';
import { startTabDrag } from './tab-drag.ts';

const KEY = 'layout:watch';
const SAVE_MS = 400;

export type Wm = { refresh(): void; dispose(): void };

export function createWmController(rt: Runtime): Wm {
  const host = createHost();
  host.setTop(mastheadHeight());
  const projector = createProjector(rt.log);
  const env: ViewEnv = {
    call: rt.call,
    log: rt.log,
    settings: rt.settings,
    scanner: rt.scanner,
    suppressed: rt.suppressed,
  };
  const known = new Set(VIEWS.map((v) => v.id));
  const mounts = new Map<string, { el: HTMLElement; dispose: Disposer }>(); // bound: one per own view
  let root: L.LayoutNode = watchPreset();
  let rendered: Rendered | undefined;
  let saveTimer: ReturnType<typeof setTimeout> | undefined;
  let disposed = false;

  const set = (next: L.LayoutNode | null, save = true): void => {
    root = next ?? watchPreset();
    render();
    if (!save) return;
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => void chrome.storage.local.set({ [KEY]: root }), SAVE_MS);
  };

  const mountOwn = (view: string): HTMLElement | undefined => {
    const def = VIEW_BY_ID.get(view);
    if (!def?.mount) return undefined;
    let m = mounts.get(view);
    if (!m) {
      const el = document.createElement('div');
      el.className = 'view';
      m = { el, dispose: def.mount(el, env) };
      mounts.set(view, m);
    }
    return m.el;
  };

  const ctx = {
    title: (v: string) => VIEW_BY_ID.get(v)?.title ?? v,
    isNative: (v: string) => Boolean(VIEW_BY_ID.get(v)?.slot),
    onTabDown(view: string, e: PointerEvent, tab: HTMLElement) {
      startTabDrag(e, tab, ctx.title(view), {
        panes: rendered?.panes ?? new Map(),
        layer: host.layer,
        onClick: () => set(L.activate(root, view)),
        onDrop: (paneId, zone) => set(L.moveView(root, view, paneId, zone)),
      });
    },
    onClose: (view: string) => set(L.removeView(root, view)),
    onPaneMenu(p: L.PaneNode, button: HTMLElement) {
      const splitTo = (zone: L.Zone) => () => set(L.moveView(root, p.active, p.id, zone));
      openMenu(host.layer, button, [
        { label: 'Split right', run: splitTo('right'), disabled: p.tabs.length < 2 },
        { label: 'Split down', run: splitTo('bottom'), disabled: p.tabs.length < 2 },
        { label: 'Close pane', run: () => set(L.closePane(root, p.id)) },
        { label: 'Reset layout', run: () => set(watchPreset()) },
        { label: 'Turn off tiling (Alt+W)', run: () => void patchSettings({ wmEnabled: false }) },
      ]);
    },
    onAddMenu(p: L.PaneNode, button: HTMLElement) {
      const open = new Set(L.views(root));
      const items = VIEWS.filter((v) => !open.has(v.id)).map((v) => ({
        label: v.title,
        run: () => set(L.addView(root, p.id, v.id, 'center')),
      }));
      openMenu(host.layer, button, items);
    },
    onHandleDown(s: L.SplitNode, index: number, e: PointerEvent, cells: HTMLElement[]) {
      startResize(e, s.dir, index, cells, (sizes) => set(L.resize(root, s.id, sizes)));
    },
  };

  function render(): void {
    if (disposed) return;
    rendered = renderLayout(root, ctx);
    host.root.replaceChildren(rendered.el);
    for (const [view, body] of rendered.bodies) {
      const el = mountOwn(view);
      if (el) body.append(el);
    }
    const open = new Set(L.views(root));
    for (const [view, m] of mounts) if (!open.has(view)) m.dispose(), mounts.delete(view);
    const entries = VIEWS.flatMap((v) =>
      v.slot && open.has(v.id)
        ? [{ view: v.id, slot: v.slot, body: rendered?.bodies.get(v.id) ?? null }]
        : [],
    );
    projector.sync(entries);
  }

  render();
  projector.refresh();
  void chrome.storage.local.get(KEY).then((s) => {
    const saved = L.parseLayout(s[KEY]);
    if (saved && !disposed) set(L.retainViews(saved, known), false);
  });

  return {
    refresh() {
      host.setTop(mastheadHeight());
      projector.refresh();
    },
    dispose() {
      disposed = true;
      clearTimeout(saveTimer);
      projector.dispose();
      for (const m of mounts.values()) m.dispose();
      mounts.clear();
      host.dispose();
    },
  };
}
