import { MASTHEAD, NATIVE_SLOTS, type NativeSlot } from './selectors.ts';

export function resolveSlot(slot: NativeSlot): HTMLElement | null {
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
