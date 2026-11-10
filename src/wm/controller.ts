// WM controller for one page kind: layout state, persistence, rendering, own-view mounts, projection.
import type { Runtime } from '../content/runtime.ts';
import { layoutKey } from '../shared/layout-store.ts';
import { patchSettings } from '../shared/settings.ts';
import type { WmFamily } from '../shared/types.ts';
import { kindOf, viewOf, viewsOf } from '../views/registry.ts';
import { onGuideButton } from '../youtube/guide.ts';
import { mastheadHeight, resetPageScroll } from '../youtube/slots.ts';
import { createHost } from './host.ts';
import { NEW_TAB } from './launcher.ts';
import * as L from './layout.ts';
import { addEdge } from './layout-edge.ts';
import { parseLayout } from './layout-parse.ts';
import { openMenu } from './menus.ts';
import { createOwnViews } from './own-views.ts';
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
  const env = { call: rt.call, log: rt.log, settings: rt.settings, scanner: rt.scanner };
  const kinds = new Set(VIEWS.map((v) => v.id));
  /** Tabs this family can show: its views (own ones in any number) and New tab pages. */
  const known = {
    has: (tab: string): boolean =>
      kindOf(tab) === NEW_TAB ||
      (kinds.has(kindOf(tab)) && (tab === kindOf(tab) || Boolean(viewOf(tab)?.mount))),
  };
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

  /** The New tab page `tab` becomes `kind`: a native view moves here, an own view opens (again). */
  const launcher = (tab: string) => ({
    choices: () => {
      const open = new Set(L.views(root).map(kindOf));
      return VIEWS.map((v) => ({
        kind: v.id,
        title: v.title,
        hint: v.hint,
        native: !v.mount,
        open: open.has(v.id),
      }));
    },
    pick(kind: string) {
      const native = !viewOf(kind)?.mount;
      const base = native ? (L.removeView(root, kind) ?? root) : root;
      set(L.replaceView(base, tab, native ? kind : own.fresh(kind, new Set(L.views(root)))));
    },
    close: () => set(L.removeView(root, tab)),
  });
  const own = createOwnViews(env, family, launcher, (tab, title) => {
    const span = rendered?.el.querySelector(`.tab[data-view="${tab}"] > span`);
    if (span) span.textContent = title;
    span?.parentElement?.setAttribute('title', title);
  });

  const ctx = {
    title: own.title,
    isNative: (v: string) => Boolean(viewOf(v)?.slot),
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
    onAdd(p: L.PaneNode) {
      const tab =
        p.tabs.find((t) => kindOf(t) === NEW_TAB) ?? own.fresh(NEW_TAB, new Set(L.views(root)));
      set(p.tabs.includes(tab) ? L.activate(root, tab) : L.addView(root, p.id, tab, 'center'));
      own.focus(tab);
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
      const el = own.el(view);
      if (el) body.append(el);
    }
    const open = new Set(L.views(root));
    own.sync(open);
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
    if (!p) set(addEdge(root, 'guide', 'left', GUIDE_PX / Math.max(innerWidth, 1)));
    else if (p.active !== 'guide') set(L.activate(root, 'guide'));
    else set(L.removeView(root, 'guide'));
  });

  const offLook = rt.settings.subscribe(host.look);
  host.look(rt.settings.get());
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
      offLook();
      offPage();
      projector.dispose();
      own.dispose();
      host.dispose();
    },
  };
}
