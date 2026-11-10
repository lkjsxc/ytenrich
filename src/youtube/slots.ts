import { GUIDE_RENDERER, MASTHEAD, NATIVE_SLOTS, type NativeSlot } from './selectors.ts';

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
