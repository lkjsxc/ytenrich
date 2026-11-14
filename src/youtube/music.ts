// YouTube Music's DOM names (with music.css, the only place for them). Verified against live DOM 2026-11-14
// (docs/youtube-dom.md § YouTube Music).
import type { NativeSlot } from './selectors.ts';

/** The app shell. It carries `[player-visible]` once something is loaded in the player, and `player-ui-state`:
 * INACTIVE, PLAYER_PAGE_OPEN, MINIPLAYER, PLAYER_BAR_ONLY or FULLSCREEN. */
export const LAYOUT = 'ytmusic-app-layout';
export const LAYOUT_ATTRS = ['player-ui-state', 'player-visible'];
const PLAYING = `${LAYOUT}[player-visible] ytmusic-player-page`;

/** Native slots projected into WM panes. `page` holds every browse and search page (the app keeps it while the
 * player page is open over it); `player` and `queue` are the two panels of the player page, which exist only
 * while something is loaded; `guide` is the full navigation menu (the mini guide is another element). */
export const SLOTS: Partial<Record<NativeSlot, string>> = {
  page: `${LAYOUT} > #content`,
  player: `${PLAYING} #main-panel`,
  queue: `${PLAYING} #side-panel`,
  guide: 'ytmusic-app #guide-wrapper',
};

export const NAV_BAR = 'ytmusic-nav-bar';
/** The bar along the bottom (transport, seek, volume), slid in while something is loaded. */
export const PLAYER_BAR = `${LAYOUT}[player-visible] > ytmusic-player-bar`;
/** The nav bar's right-hand group (cast, settings, account): the workspace switcher leads it. The search box's
 * own container changes size and place on search pages, so nothing of ours goes beside it there. */
export const NAV_END = 'ytmusic-nav-bar #right-content';
export const GUIDE_BUTTON = 'ytmusic-nav-bar #guide-button';
