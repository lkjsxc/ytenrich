// One MutationObserver + one IntersectionObserver feed every feature with recommendation items.
import type { Signal } from '../shared/signal.ts';
import type { Kind, Surface } from '../shared/types.ts';
import { anchorsIn, extractItem, itemRootOf } from '../youtube/extract.ts';
import type { Page } from './route-signal.ts';

export type RecoItem = {
  readonly el: Element;
  readonly anchor: HTMLAnchorElement;
  readonly id: string;
  readonly kind: Kind;
  readonly surface: Surface;
  readonly title: string;
  readonly channel: string;
  /** Mixes: the video the list opens with. */
  readonly video?: string;
};
type Listener = (item: RecoItem) => void;

/** The WM draws or hides native lists by these attributes, which changes what the user can see. */
const SLOT_ATTRS = ['ytenrich-slot', 'ytenrich-slot-inactive'];
const MAX_PAGE_ITEMS = 3000; // per-navigation item index bound (cleared on navigation)

export type Scanner = {
  onItem(fn: Listener): () => void;
  onSeen(fn: Listener): () => void;
  /** Called at most once per frame after any observed DOM mutation (for late-rendered item parts). */
  onTick(fn: () => void): () => void;
  /** Items found during the current navigation, keyed by video id. */
  pageItems(): ReadonlyMap<string, RecoItem>;
  dispose(): void;
};

export function createScanner(page: Signal<Page>): Scanner {
  const itemListeners = new Set<Listener>();
  const seenListeners = new Set<Listener>();
  const byEl = new WeakMap<Element, RecoItem>();
  let items = new Map<string, RecoItem>();
  let seen = new Set<string>(); // bounded by items per navigation
  const batch = new Set<Element>(); // roots visited in the current scan (cleared after each)
  const tickListeners = new Set<() => void>();
  let tickFrame = 0;
  const tick = (): void => {
    tickFrame = 0;
    for (const fn of tickListeners) fn();
  };

  const markSeen = (item: RecoItem): void => {
    if (seen.has(item.id)) return;
    seen.add(item.id);
    for (const fn of seenListeners) fn(item);
  };

  // In view but not drawn (its tile is closed or behind another tab): seen once it shows. Bound: page items.
  let latent = new Set<Element>();
  const shown = (el: Element): boolean => el.checkVisibility({ visibilityProperty: true });
  const io = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        const item = byEl.get(e.target);
        if (!item || !e.isIntersecting) latent.delete(e.target);
        else if (shown(e.target)) markSeen(item);
        else latent.add(e.target);
      }
    },
    { threshold: 0.5 },
  );
  const recheck = (): void => {
    for (const el of latent) {
      const item = shown(el) ? byEl.get(el) : undefined;
      if (!item) continue;
      latent.delete(el);
      markSeen(item);
    }
  };

  const visit = (anchor: Element): void => {
    const root = itemRootOf(anchor);
    if (!root || batch.has(root)) return; // a lockup holds several anchors to the same video
    batch.add(root);
    const info = extractItem(root);
    if (!info) return;
    const prev = byEl.get(root);
    if (prev && prev.id === info.id && prev.anchor === info.anchor) return;
    const item: RecoItem = { ...info, el: root, surface: page.get().kind };
    if (!prev) io.observe(root);
    byEl.set(root, item);
    if (items.size < MAX_PAGE_ITEMS) items.set(item.id, item);
    for (const fn of itemListeners) fn(item);
  };

  const scan = (node: Element): void => {
    for (const a of anchorsIn(node)) visit(a);
  };
  const scanAll = (records: readonly MutationRecord[]): void => {
    let slots = false;
    for (const r of records) {
      if (r.type === 'attributes' && r.attributeName !== 'href') slots = true;
      else if (r.type === 'attributes') visit(r.target as Element);
      else for (const n of r.addedNodes) if (n.nodeType === 1) scan(n as Element);
    }
    batch.clear();
    if (slots && latent.size) recheck();
  };

  const mo = new MutationObserver((records) => {
    scanAll(records);
    if (tickListeners.size) tickFrame ||= requestAnimationFrame(tick);
  });
  mo.observe(document.documentElement, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['href', ...SLOT_ATTRS],
  });

  const unsubPage = page.subscribe(() => {
    items = new Map();
    seen = new Set();
    latent = new Set();
  });
  if (document.body) scan(document.body), batch.clear();

  return {
    onItem(fn) {
      itemListeners.add(fn);
      return () => itemListeners.delete(fn);
    },
    onSeen(fn) {
      seenListeners.add(fn);
      return () => seenListeners.delete(fn);
    },
    onTick(fn) {
      tickListeners.add(fn);
      return () => tickListeners.delete(fn);
    },
    pageItems: () => items,
    dispose() {
      mo.disconnect();
      io.disconnect();
      cancelAnimationFrame(tickFrame);
      tickListeners.clear();
      unsubPage();
      itemListeners.clear();
      seenListeners.clear();
    },
  };
}
