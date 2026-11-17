// WM controller for a layout family: state, persistence, own views and native projection.
import type { Runtime } from '../content/runtime.ts';
import type { WmFamily } from '../shared/types.ts';
import { kindOf, viewOf, viewsOf } from '../views/registry.ts';
import { chromeInsets, resetPageScroll } from '../youtube/slots.ts';
import { createHost } from './host.ts';
import { NEW_TAB } from './launcher.ts';
import * as L from './layout.ts';
import { parseLayout } from './layout-parse.ts';
import { openMenu } from './menus.ts';
import { nativeActions } from './native-actions.ts';
import { createOptional, INTRODUCED_KEY } from './optional.ts';
import { createOwnViews } from './own-views.ts';
import { presetOf } from './presets.ts';
import type { Projector } from './projector.ts';
import { type Rendered, renderLayout } from './render.ts';
import { startResize } from './resize.ts';
import { createSessionViews } from './session-views.ts';
import type { Space } from './spaces.ts';
import { startTabDrag } from './tab-drag.ts';

export type Wm = { readonly family: WmFamily; refresh(): void; dispose(): void };

/** The shared projector lets the next workspace take over native elements without releasing them for a frame. */
export function createWmController(
  rt: Runtime,
  family: WmFamily,
  at: Space,
  projector: Projector,
): Wm {
  const preset = (): L.LayoutNode => presetOf(family, at.index);
  const VIEWS = viewsOf(family);
  const host = createHost();
  const kinds = new Set(VIEWS.map((v) => v.id));
  /** Tabs this family can show: its views (own ones in any number) and New tab pages. */
  const known = {
    has: (tab: string): boolean =>
      kindOf(tab) === NEW_TAB ||
      (kinds.has(kindOf(tab)) && (tab === kindOf(tab) || Boolean(viewOf(tab)?.mount))),
  };
  const load = (value: unknown): L.LayoutNode | null => {
    const saved = value === undefined ? preset() : parseLayout(value);
    return saved && L.retainViews(saved, known);
  };
  let root: L.LayoutNode = load(at.stored) ?? preset();
  const session = createSessionViews(rt, family);
  let rendered: Rendered | undefined;
  let disposed = false;

  const set = (next: L.LayoutNode | null, save = true): void => {
    const closing =
      family === 'watch' &&
      L.paneOfView(root, 'player') &&
      (!next || !L.paneOfView(next, 'player'));
    root = next ?? preset();
    if (save) at.save(session.saved(root));
    if (closing) rt.playback.close();
    render();
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
  const own = createOwnViews(rt, family, launcher, (tab, title) => {
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
    closeClicks: () => rt.settings.get().closeClicks,
    onPaneMenu(p: L.PaneNode, button: HTMLElement) {
      const splitTo = (zone: L.Zone) => () => set(L.moveView(root, p.active, p.id, zone));
      openMenu(host.layer, button, [
        { label: 'Split right', run: splitTo('right'), disabled: p.tabs.length < 2 },
        { label: 'Split down', run: splitTo('bottom'), disabled: p.tabs.length < 2 },
        { label: 'Close pane', run: () => set(L.closePane(root, p.id)) },
        {
          label: 'Reset layout',
          run: () => {
            session.reset();
            set(preset());
          },
        },
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
    host.inset(chromeInsets()); // YouTube Music's player bar comes and goes with its optional views
    root = session.navigate(root, optional.visible(root));
    const shown = optional.visible(root);
    session.allow(shown);
    rendered = renderLayout(shown, ctx);
    host.root.replaceChildren(rendered.el);
    for (const tab of rendered.el.querySelectorAll('.tab.active'))
      tab.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    for (const [view, body] of rendered.bodies) {
      const el = own.el(view);
      if (el) body.append(el);
    }
    const open = new Set(L.views(root));
    own.sync(open);
    const drawn = new Set(L.views(shown));
    const entries = VIEWS.flatMap((v) =>
      v.slot && drawn.has(v.id)
        ? [{ slot: v.slot, part: v.part, body: rendered?.bodies.get(v.id) ?? null }]
        : [],
    );
    projector.sync(entries);
  }

  const optional = createOptional(VIEWS, () => render(), rt.scanner.onTick);

  const offStore = at.watch((value) => {
    const next = load(value);
    if (next && !disposed && JSON.stringify(next) !== JSON.stringify(session.saved(root))) {
      session.reset();
      set(next, false);
    }
  });

  const offNative = nativeActions(() => root, set, kinds);
  const offLook = rt.settings.subscribe(host.look);
  host.look(rt.settings.get());
  render();
  projector.refresh();
  void chrome.storage.local.get(INTRODUCED_KEY).then((s) => {
    const next = optional.introduce(root, s[INTRODUCED_KEY]);
    if (next !== root) set(next);
  });

  let nav = rt.page.get().nav;
  const offPage = rt.page.subscribe((p) => {
    if (p.nav === nav) return;
    nav = p.nav;
    if (resetPageScroll() && L.behind(root, 'page')) set(L.activate(root, 'page'));
  });

  return {
    family,
    refresh() {
      const next = session.navigate(root, optional.visible(root));
      if (next !== root) {
        root = next;
        render();
      } else host.inset(chromeInsets());
      projector.refresh();
    },
    dispose() {
      disposed = true;
      offStore();
      offNative();
      optional.dispose();
      offLook();
      offPage();
      own.dispose();
      host.dispose();
    },
  };
}
