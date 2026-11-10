import {
  GUIDE_RENDERER,
  MASTHEAD,
  NATIVE_SLOTS,
  type NativeSlot,
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
