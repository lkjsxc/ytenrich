// YouTube Music while tiled: what the app's player page does for itself and its parts, as tiles, need from us.
// The app has one side panel with tabs of its own; ytenrich draws the queue and that panel's other lists as
// separate tiles, so the app's tab follows the tile on show, the queue tile follows the track (the app scrolls
// its own panel, which is no longer the queue's scroller), and the cover's address reaches CSS for the backdrop.
import * as M from './music.ts';

const PART = 'ytenrich-part';
const NONE = 'ytenrich-none'; // the track has nothing for the part on show (music.css words it)
const COVER = '--ytenrich-cover';
const AGAIN_MS = 1500;
const OURS = ['ytenrich-slot', PART, 'ytenrich-slot-inactive'];
const shown = (el: Element | null): el is HTMLElement =>
  Boolean(el?.hasAttribute('ytenrich-slot')) && !el?.hasAttribute('ytenrich-slot-inactive');

/** `ticks`: the scanner's DOM ticks (the player page is stamped after us). Returns the disposer. */
export function createMusicLive(ticks: (fn: () => void) => () => void): () => void {
  let page: HTMLElement | null = null;
  let frame = 0;
  let chose = false; // the app's selected side tab is our doing
  let clickedAt = 0; // a click the app ignored (it may, mid-advertisement) is repeated, but not at once
  let track = ''; // the playing queue row's text: another one is another track
  let queued = false; // the queue tile was on show at the last look
  let cover = '';
  let direct = location.pathname === '/watch'; // loaded on the player page: no page behind it yet

  /** The app's side tab follows the Lyrics / Related tile on show, and goes back to its queue without one. */
  const sideTab = (root: HTMLElement): void => {
    const side = root.querySelector<HTMLElement>(M.SIDE);
    const tabs = [...root.querySelectorAll<HTMLElement>(M.SIDE_TAB)];
    const part = shown(side) ? (side.getAttribute(PART) ?? '') : '';
    if (!part && !chose) return void side?.removeAttribute(NONE);
    const tab = part ? tabs[M.sideTabIndex(part, tabs.length)] : tabs[0];
    const off =
      !tab || tab.hasAttribute('disabled') || tab.getAttribute('aria-disabled') === 'true';
    side?.toggleAttribute(NONE, Boolean(part) && off);
    if (off || !tab) return;
    chose = Boolean(part);
    if (tab.classList.contains(M.SIDE_TAB_ON) || performance.now() - clickedAt < AGAIN_MS) return;
    clickedAt = performance.now();
    tab.click();
  };

  /** On a new track the queue tile brings its row into view, one row down from its top (unless the pointer is on
   * the tile), and lyrics start at their top: the app does both for its own panel only while its page is open. */
  const follow = (root: HTMLElement): void => {
    const now = root.querySelector<HTMLElement>(M.QUEUE_PLAYING);
    const key = now?.textContent ?? '';
    const queue = root.querySelector<HTMLElement>('[ytenrich-slot="queue"]');
    const fresh = shown(queue) !== queued; // the tile has just come on show: place it without a glide
    queued = shown(queue);
    if (key === track && !fresh) return;
    if (key !== track) root.querySelector(`${M.SIDE}[${PART}="lyrics"]`)?.scrollTo(0, 0);
    track = key;
    if (!now || !shown(queue) || queue.matches(':hover')) return;
    const top =
      queue.scrollTop +
      now.getBoundingClientRect().top -
      queue.getBoundingClientRect().top -
      now.offsetHeight;
    queue.scrollTo({ top, behavior: fresh ? 'instant' : 'smooth' });
  };

  /** The cover's address as a CSS variable on the player: music.css paints it, blurred, behind the cover. */
  const backdrop = (root: HTMLElement): void => {
    const player = root.querySelector<HTMLElement>(M.PLAYER);
    const src = player?.querySelector<HTMLImageElement>(M.COVER_IMG)?.src ?? '';
    if (!player || src === cover) return;
    cover = src;
    if (/^https:/.test(src)) player.style.setProperty(COVER, `url(${JSON.stringify(src)})`);
    else player.style.removeProperty(COVER);
  };

  /** A tab loaded on the player page has nothing in its Page tile: open Home there, once. */
  const fill = (): void => {
    direct &&= location.pathname === '/watch';
    if (!direct || !shown(document.querySelector(M.PAGE_BLANK))) return;
    direct = false;
    document.querySelector<HTMLElement>(M.HOME_LINK)?.click();
  };

  const sync = (): void => {
    frame = 0;
    if (!page?.isConnected) return;
    fill();
    sideTab(page);
    follow(page);
    backdrop(page);
  };
  const schedule = (): void => {
    frame ||= requestAnimationFrame(sync);
  };
  const mo = new MutationObserver(schedule);
  const attach = (): void => {
    if (page?.isConnected) return;
    page = document.querySelector<HTMLElement>(M.PLAYER_PAGE);
    if (!page) return;
    mo.disconnect();
    mo.observe(page, {
      subtree: true,
      attributes: true,
      attributeFilter: [...M.LIVE_ATTRS, ...OURS],
    });
    schedule();
  };
  const offTicks = ticks(attach);
  attach();
  return () => {
    offTicks();
    mo.disconnect();
    cancelAnimationFrame(frame);
    const side = page?.querySelector(`[${NONE}]`);
    side?.removeAttribute(NONE);
    page?.querySelector<HTMLElement>(`[style*="${COVER}"]`)?.style.removeProperty(COVER);
    page = null;
  };
}
