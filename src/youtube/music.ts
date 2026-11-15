// YouTube Music's DOM names (with music.css and music-live.ts, the only place for them). Verified against live DOM
// 2026-11-14 (docs/youtube-dom.md § YouTube Music).
import type { NativeSlot } from './selectors.ts';

/** The app shell. It carries `[player-visible]` once something is loaded in the player, and `player-ui-state`:
 * INACTIVE, PLAYER_PAGE_OPEN, MINIPLAYER, PLAYER_BAR_ONLY or FULLSCREEN. */
export const LAYOUT = 'ytmusic-app-layout';
export const LAYOUT_ATTRS = ['player-ui-state', 'player-visible'];
const PLAYER_PAGE = 'ytmusic-player-page';
const PLAYING = `${LAYOUT}[player-visible] ${PLAYER_PAGE}`;
/** The player page's side panel is a row of the app's own tabs (Up next, Lyrics, Comments, Related) over one
 * renderer: the queue's container is its first child, `[hidden]` while another tab is selected; that tab's list
 * (a section list) is stamped beside it. */
const SIDE = '#side-panel > ytmusic-tab-renderer';

/** Native slots projected into WM panes. `page` holds every browse and search page (the app keeps it while the
 * player page is open over it); `player`, `queue` and `side` are parts of the player page, which exist only while
 * something is loaded; `guide` is the full navigation menu (the mini guide is another element). The queue's
 * container is projected by itself, out of the renderer that `side` projects, so Up next and Lyrics can show at
 * once. */
export const SLOTS: Partial<Record<NativeSlot, string>> = {
  page: `${LAYOUT} > #content`,
  player: `${PLAYING} #main-panel`,
  queue: `${PLAYING} ${SIDE} > div:has(> ytmusic-player-queue)`,
  side: `${PLAYING} ${SIDE}`,
  guide: 'ytmusic-app #guide-wrapper',
};

export const NAV_BAR = 'ytmusic-nav-bar';
/** The bar along the bottom (transport, seek, volume), slid in while something is loaded. The app ships two
 * elements for it (`ytmusic-player-bar`, and `ytmusic-miniplayer` in its newer shell); both sit in this slot. */
export const PLAYER_BAR = `${LAYOUT}[player-visible] > [slot="player-bar"]`;
/** The nav bar's right-hand group (cast, settings, account): the workspace switcher leads it. The search box's
 * own container changes size and place on search pages, so nothing of ours goes beside it there. */
export const NAV_END = 'ytmusic-nav-bar #right-content';
export const GUIDE_BUTTON = 'ytmusic-nav-bar #guide-button';

/** Inside the player page (`music-live.ts` looks these up from it). The app's tabs over the side panel carry no
 * name: Lyrics is the second, Related the last, and Comments the third where there are four. A tab the track has
 * nothing for is `disabled`. */
export { PLAYER_PAGE, SIDE };
export const SIDE_TAB = '#side-panel > tp-yt-paper-tabs tp-yt-paper-tab';
export const SIDE_TAB_ON = 'iron-selected';
/** Index of the app's tab for a part of the side panel, among `count` tabs (-1: the app has none). */
export function sideTabIndex(part: string, count: number): number {
  if (part === 'lyrics') return count > 1 ? 1 : -1;
  return part === 'related' && count > 2 ? count - 1 : -1;
}
/** The row of the queue that is being played (the app marks the next one as playback moves on). */
export const QUEUE_PLAYING = 'ytmusic-player-queue-item[selected]';
/** The player and its cover image. */
export const PLAYER = 'ytmusic-player#player';
export const COVER_IMG = '#song-image img';
/** What the app changes when the track, its cover or the selected side tab does. */
export const LIVE_ATTRS = ['selected', 'aria-selected', 'aria-disabled', 'disabled', 'src'];
/** The page tile's element while it holds no page: a direct load of `/watch` has none behind the player. The logo
 * link opens Home (the player stays). */
export const PAGE_BLANK = `${LAYOUT}[player-visible] > #content:not(:has(> :not([hidden])))`;
export const HOME_LINK = 'ytmusic-nav-bar ytmusic-logo a';
