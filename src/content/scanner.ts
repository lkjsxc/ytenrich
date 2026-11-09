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
};
type Listener = (item: RecoItem) => void;

const MAX_PAGE_ITEMS = 3000; // per-navigation item index bound (cleared on navigation)

export type Scanner = {
  onItem(fn: Listener): () => void;
  onSeen(fn: Listener): () => void;
  /** Called at most once per frame after any observed DOM mutation (for late-rendered item parts). */
  onTick(fn: () => void): () => void;
  /** Items found during the current navigation, keyed by video id. */
  pageItems(): ReadonlyMap<string, RecoItem>;
  readonly version: Signal<number>;
  markSeen(item: RecoItem): void;
  dispose(): void;
};

export function createScanner(page: Signal<Page>, version: Signal<number>): Scanner {
  const itemListeners = new Set<Listener>();
  const seenListeners = new Set<Listener>();
  const byEl = new WeakMap<Element, RecoItem>();
  let items = new Map<string, RecoItem>();
  let seen = new Set<string>(); // bounded by items per navigation
  let bumpQueued = false;
  const tickListeners = new Set<() => void>();
  let tickFrame = 0;
  const tick = (): void => {
    tickFrame = 0;
    for (const fn of tickListeners) fn();
  };

  const bump = (): void => {
    if (bumpQueued) return;
    bumpQueued = true;
    setTimeout(() => {
      bumpQueued = false;
      version.update((v) => v + 1);
    }, 250);
  };

  const markSeen = (item: RecoItem): void => {
    if (seen.has(item.id)) return;
    seen.add(item.id);
    for (const fn of seenListeners) fn(item);
  };

  const io = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        const item = e.isIntersecting ? byEl.get(e.target) : undefined;
        if (item) markSeen(item);
      }
    },
    { threshold: 0.5 },
  );

  const visit = (anchor: Element): void => {
    const root = itemRootOf(anchor);
    if (!root) return;
    const info = extractItem(root);
    if (!info) return;
    const prev = byEl.get(root);
    if (prev && prev.id === info.id && prev.anchor === info.anchor) return;
    const item: RecoItem = { ...info, el: root, surface: page.get().kind };
    if (!prev) io.observe(root);
    byEl.set(root, item);
    if (items.size < MAX_PAGE_ITEMS) items.set(item.id, item);
    for (const fn of itemListeners) fn(item);
    bump();
  };

  const scan = (node: Element): void => {
    for (const a of anchorsIn(node)) visit(a);
  };

  const mo = new MutationObserver((records) => {
    for (const r of records) {
      if (r.type === 'attributes') visit(r.target as Element);
      else for (const n of r.addedNodes) if (n.nodeType === 1) scan(n as Element);
    }
    if (tickListeners.size) tickFrame ||= requestAnimationFrame(tick);
  });
  mo.observe(document.documentElement, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['href'],
  });

  const unsubPage = page.subscribe(() => {
    items = new Map();
    seen = new Set();
    bump();
  });
  if (document.body) scan(document.body);

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
    version,
    markSeen,
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
