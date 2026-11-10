// WM controller for one page kind: layout state, persistence, rendering, own-view mounts, projection.
import type { Runtime } from '../content/runtime.ts';
import { layoutKey } from '../shared/layout-store.ts';
import { patchSettings } from '../shared/settings.ts';
import type { Disposer } from '../shared/signal.ts';
import type { WmFamily } from '../shared/types.ts';
import { VIEW_BY_ID, type ViewEnv, viewsOf } from '../views/registry.ts';
import { onGuideButton } from '../youtube/guide.ts';
import { mastheadHeight, resetPageScroll } from '../youtube/slots.ts';
import { createHost } from './host.ts';
import * as L from './layout.ts';
import { parseLayout } from './layout-parse.ts';
import { openMenu } from './menus.ts';
import { GUIDE_PX, presetOf } from './presets.ts';
import { createProjector } from './projector.ts';
import { type Rendered, renderLayout } from './render.ts';
import { startResize } from './resize.ts';
import { startTabDrag } from './tab-drag.ts';

const SAVE_MS = 400;

export type Wm = { readonly family: WmFamily; refresh(): void; dispose(): void };

export function createWmController(rt: Runtime, family: WmFamily): Wm {
  const KEY = layoutKey(family);
  const preset = (): L.LayoutNode => presetOf(family);
  const VIEWS = viewsOf(family);
  const host = createHost();
  host.setTop(mastheadHeight());
  const projector = createProjector(rt.log);
  const env: ViewEnv = {
    call: rt.call,
    log: rt.log,
    settings: rt.settings,
    scanner: rt.scanner,
  };
  const known = new Set(VIEWS.map((v) => v.id));
  const mounts = new Map<string, { el: HTMLElement; dispose: Disposer }>(); // bound: one per own view
  let root: L.LayoutNode = preset();
  let rendered: Rendered | undefined;
  let saveTimer: ReturnType<typeof setTimeout> | undefined;
  let disposed = false;

  const set = (next: L.LayoutNode | null, save = true): void => {
    root = next ?? preset();
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
        onDrop: (paneId, zone, index) => set(L.moveView(root, view, paneId, zone, index)),
      });
    },
    onClose: (view: string) => set(L.removeView(root, view)),
    onPaneMenu(p: L.PaneNode, button: HTMLElement) {
      const splitTo = (zone: L.Zone) => () => set(L.moveView(root, p.active, p.id, zone));
      openMenu(host.layer, button, [
        { label: 'Split right', run: splitTo('right'), disabled: p.tabs.length < 2 },
        { label: 'Split down', run: splitTo('bottom'), disabled: p.tabs.length < 2 },
        { label: 'Close pane', run: () => set(L.closePane(root, p.id)) },
        { label: 'Reset layout', run: () => set(preset()) },
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
        ? [{ slot: v.slot, part: v.part, body: rendered?.bodies.get(v.id) ?? null }]
        : [],
    );
    projector.sync(entries);
  }

  // Follow stored layout changes (reset from Settings, edits in other tabs); our own saves are no-ops.
  const adopt = (value: unknown): void => {
    const saved = value === undefined ? preset() : parseLayout(value);
    const next = saved && L.retainViews(saved, known);
    if (!next || disposed || JSON.stringify(next) === JSON.stringify(root)) return;
    clearTimeout(saveTimer);
    set(next, false);
  };
  const onStorage = (c: Record<string, chrome.storage.StorageChange>, area: string): void => {
    if (area === 'local' && c[KEY]) adopt(c[KEY].newValue);
  };
  chrome.storage.onChanged.addListener(onStorage);

  // Hamburger toggles the Guide tile: add it on the far left, focus it, or close it.
  const offGuide = onGuideButton(() => {
    const p = L.paneOfView(root, 'guide');
    if (!p) set(L.addEdge(root, 'guide', 'left', GUIDE_PX / Math.max(innerWidth, 1)));
    else if (p.active !== 'guide') set(L.activate(root, 'guide'));
    else set(L.removeView(root, 'guide'));
  });

  render();
  projector.refresh();
  void chrome.storage.local.get(KEY).then((s) => s[KEY] !== undefined && adopt(s[KEY]));

  // Same-element navigations (search → search) would otherwise keep the old scroll offset.
  let nav = rt.page.get().nav;
  const offPage = rt.page.subscribe((p) => {
    if (p.nav !== nav) (nav = p.nav), resetPageScroll();
  });

  return {
    family,
    refresh() {
      host.setTop(mastheadHeight());
      projector.refresh();
    },
    dispose() {
      disposed = true;
      clearTimeout(saveTimer);
      chrome.storage.onChanged.removeListener(onStorage);
      offGuide();
      offPage();
      projector.dispose();
      for (const m of mounts.values()) m.dispose();
      mounts.clear();
      host.dispose();
    },
  };
}
