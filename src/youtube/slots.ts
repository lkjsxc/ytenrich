import {
  CHAPTERS_PANEL,
  GUIDE_RENDERER,
  MASTHEAD,
  NATIVE_SLOTS,
  type NativeSlot,
  PANEL_EXPANDED,
  PANELS,
  PLAYLIST_PANEL,
} from './selectors.ts';
import { waitFor } from './wait.ts';

/** The guide's scroller exists before its content: below ~1312px YouTube shows the mini guide and stamps
 * `ytd-guide-renderer` only on first drawer open. Report it missing until then so the projector wakes it. */
export function resolveSlot(slot: NativeSlot): HTMLElement | null {
  if (slot === 'guide' && !document.querySelector(GUIDE_RENDERER)) return null;
  return document.querySelector<HTMLElement>(NATIVE_SLOTS[slot]);
}

export function resetPageScroll(): void {
  resolveSlot('page')?.scrollTo(0, 0);
}

export function mastheadHeight(): number {
  return document.querySelector<HTMLElement>(MASTHEAD)?.offsetHeight || 56;
}

export function isFullscreen(): boolean {
  return document.fullscreenElement !== null;
}

/** Calls `cb` whenever the playlist panel appears or goes away (YouTube toggles its `hidden` attribute). */
export function onPlaylistToggle(cb: () => void): () => void {
  const mo = new MutationObserver(cb);
  let off = false;
  void waitFor(() => document.querySelector(PLAYLIST_PANEL) ?? undefined, 10_000).then((el) => {
    if (!el || off) return;
    mo.observe(el, { attributes: true, attributeFilter: ['hidden'] });
    cb();
  });
  return () => {
    off = true;
    mo.disconnect();
  };
}

/** Calls `cb` when YouTube opens the chapter list (the chapter name in the player, "View all" in the description). */
export function onChaptersOpen(cb: () => void): () => void {
  const opened = (r: MutationRecord): boolean =>
    (r.target as Element).matches(CHAPTERS_PANEL) &&
    (r.target as Element).getAttribute('visibility') === PANEL_EXPANDED;
  const mo = new MutationObserver((records) => records.some(opened) && cb());
  let off = false;
  void waitFor(() => document.querySelector(PANELS) ?? undefined, 10_000).then((el) => {
    if (el && !off)
      mo.observe(el, { subtree: true, attributes: true, attributeFilter: ['visibility'] });
  });
  return () => {
    off = true;
    mo.disconnect();
  };
}
