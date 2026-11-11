// Builds pane/split DOM for a layout. Rebuilt only on structural change; resize mutates flex-grow in place.
import { h } from '../shared/h.ts';
import type { LayoutNode, PaneNode, SplitNode, ViewId } from './layout.ts';
import { closeButton, forgetStrips, strip } from './strip.ts';

export type RenderCtx = {
  title(view: ViewId): string;
  isNative(view: ViewId): boolean;
  onTabDown(view: ViewId, e: PointerEvent, tab: HTMLElement): void;
  onClose(view: ViewId): void;
  /** Clicks on × that close a tab (a guard against closing by accident). */
  closeClicks(): number;
  onPaneMenu(pane: PaneNode, button: HTMLElement): void;
  onAdd(pane: PaneNode): void;
  onHandleDown(split: SplitNode, index: number, e: PointerEvent, cells: HTMLElement[]): void;
};
export type Rendered = {
  el: HTMLElement;
  bodies: Map<ViewId, HTMLElement>;
  panes: Map<string, HTMLElement>;
};

export function renderLayout(root: LayoutNode, ctx: RenderCtx): Rendered {
  const out: Rendered = { el: document.createElement('div'), bodies: new Map(), panes: new Map() };
  forgetStrips();
  out.el = renderNode(root, ctx, out);
  return out;
}

function renderNode(node: LayoutNode, ctx: RenderCtx, out: Rendered): HTMLElement {
  return node.type === 'pane' ? renderPane(node, ctx, out) : renderSplit(node, ctx, out);
}

function renderPane(p: PaneNode, ctx: RenderCtx, out: Rendered): HTMLElement {
  const tab = (view: ViewId): HTMLElement => {
    const close = closeButton(ctx.closeClicks, () => ctx.onClose(view));
    const el: HTMLElement = h(
      'div',
      {
        class: view === p.active ? 'tab active' : 'tab',
        'data-view': view,
        title: ctx.title(view),
      },
      h('span', null, ctx.title(view)),
      close,
    );
    el.addEventListener('pointerdown', (e) => ctx.onTabDown(view, e, el));
    return el;
  };
  const menu: HTMLElement = h(
    'button',
    { class: 'icon', title: 'Pane menu', onclick: () => ctx.onPaneMenu(p, menu) },
    '…',
  );
  const add: HTMLElement = h(
    'button',
    { class: 'icon', title: 'New tab', onclick: () => ctx.onAdd(p) },
    '+',
  );
  const body = h('div', {
    class: ctx.isNative(p.active) ? 'body native' : 'body own',
    'data-view': p.active,
  });
  out.bodies.set(p.active, body);
  const el = h(
    'div',
    { class: 'pane', 'data-pane': p.id },
    strip([menu, add, p.tabs.map(tab)]),
    body,
  );
  out.panes.set(p.id, el);
  return el;
}

function renderSplit(s: SplitNode, ctx: RenderCtx, out: Rendered): HTMLElement {
  const el = h('div', { class: `split ${s.dir}` });
  const cells: HTMLElement[] = [];
  s.children.forEach((child, i) => {
    if (i > 0) {
      const handle = h('div', { class: 'handle' });
      handle.addEventListener('pointerdown', (e) => ctx.onHandleDown(s, i - 1, e, cells));
      el.append(handle);
    }
    const cell = h(
      'div',
      { class: 'cell', style: `flex:${s.sizes[i] ?? 1} 1 0px` },
      renderNode(child, ctx, out),
    );
    cells.push(cell);
    el.append(cell);
  });
  return el;
}
