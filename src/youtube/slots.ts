import * as M from './music.ts';
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
import { SITE } from './site.ts';
import { waitFor } from './wait.ts';

const MUSIC = SITE === 'music';
const SLOTS: Partial<Record<NativeSlot, string>> = MUSIC ? M.SLOTS : NATIVE_SLOTS;

/** The guide's scroller exists before its content: below ~1312px YouTube shows the mini guide and stamps
 * `ytd-guide-renderer` only on first drawer open. Report it missing until then so the projector wakes it. */
export function resolveSlot(slot: NativeSlot): HTMLElement | null {
  if (!MUSIC && slot === 'guide' && !document.querySelector(GUIDE_RENDERER)) return null;
  const sel = SLOTS[slot];
  return sel ? document.querySelector<HTMLElement>(sel) : null;
}

const isPlayerPage = (): boolean => location.pathname === '/watch';
/** YouTube Music: the address of the page the `page` tile holds. Opening the player page changes the address
 * but not that page, so neither opening it nor coming back from it is a reason to scroll. */
let browsed = MUSIC && !isPlayerPage() ? location.href : '';

/** After a navigation: the page tile starts at its top. */
export function resetPageScroll(): void {
  if (MUSIC) {
    if (isPlayerPage() || location.href === browsed) return;
    browsed = location.href;
  }
  resolveSlot('page')?.scrollTo(0, 0);
}

/** Room the site's own bars take: the masthead above, and YouTube Music's player bar below while it shows. */
export function chromeInsets(): { top: number; bottom: number } {
  const height = (sel: string): number =>
    document.querySelector<HTMLElement>(sel)?.offsetHeight ?? 0;
  return MUSIC
    ? { top: height(M.NAV_BAR) || 64, bottom: height(M.PLAYER_BAR) }
    : { top: height(MASTHEAD) || 56, bottom: 0 };
}

export function isFullscreen(): boolean {
  return document.fullscreenElement !== null;
}

/** Calls `cb` whenever an optional slot may have appeared or gone: YouTube toggles the playlist panel's `hidden`
 * attribute; YouTube Music's shell changes state when the player loads something or empties. */
export function onSlotToggle(cb: () => void): () => void {
  const [sel, attributeFilter] = MUSIC ? [M.LAYOUT, M.LAYOUT_ATTRS] : [PLAYLIST_PANEL, ['hidden']];
  const mo = new MutationObserver(cb);
  let off = false;
  void waitFor(() => document.querySelector(sel) ?? undefined, 10_000).then((el) => {
    if (!el || off) return;
    mo.observe(el, { attributes: true, attributeFilter });
    cb();
  });
  return () => {
    off = true;
    mo.disconnect();
  };
}

/** Calls `cb` when YouTube opens the chapter list (the chapter name in the player, "View all" in the description). */
export function onChaptersOpen(cb: () => void): () => void {
  if (MUSIC) return () => {};
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
