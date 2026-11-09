import { MASTHEAD, WATCH_SLOTS, type WatchSlot } from './selectors.ts';

export function resolveWatchSlot(slot: WatchSlot): HTMLElement | null {
  return document.querySelector<HTMLElement>(WATCH_SLOTS[slot]);
}

export function mastheadHeight(): number {
  return document.querySelector<HTMLElement>(MASTHEAD)?.offsetHeight || 56;
}

export function isFullscreen(): boolean {
  return document.fullscreenElement !== null;
}
