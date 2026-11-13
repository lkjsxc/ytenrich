// The ONLY place that names YouTube DOM. Verified against live DOM 2026-11 (see docs/youtube-dom.md).
export const VIDEO_ANCHOR = 'a[href^="/watch?v="], a[href^="/shorts/"]';

/** Grid cells / wrappers win over inner lockups so hiding removes the whole cell. */
export const ITEM_ROOT_OUTER = 'ytd-rich-item-renderer, .ytGridShelfViewModelGridShelfItem';
export const ITEM_ROOT_INNER = [
  'yt-lockup-view-model',
  'ytm-shorts-lockup-view-model-v2',
  'ytd-video-renderer',
  'ytd-compact-video-renderer',
  'ytd-grid-video-renderer',
  'ytd-reel-item-renderer',
].join(', ');
/** Anchors inside these are never recommendations (player end screens, queue panels, ads). */
/** Tiles that stand for a list (Mix, playlist, podcast): a stacked thumbnail, or the classic list renderers. */
export const LIST_TILE =
  ':is(ytd-radio-renderer, ytd-compact-radio-renderer, ytd-playlist-renderer, ytd-compact-playlist-renderer, :has(yt-collection-thumbnail-view-model, yt-collections-stack))';
/** Metadata texts of a tile; one of them is the upload age ("3 months ago"). */
export const META_TEXT = '.ytContentMetadataViewModelMetadataText';
export const AGE_TEXT = `${META_TEXT}, #metadata-line span`;
/** The channel avatar inside a tile: the only image a tile loads from YouTube's avatar host. */
export const AVATAR = 'img[src^="https://yt3."]';
export const NOT_RECO =
  '#movie_player, ytd-playlist-panel-renderer, ad-button-view-model, ytd-miniplayer';

export const TITLE = [
  'h3[title]',
  'a[title].shortsLockupViewModelHostOutsideMetadataEndpoint',
  '#video-title',
  'h3',
] as const;
/** Classic renderers name the channel here (empty on a channel's own page). */
export const CHANNEL_CLASSIC = 'ytd-channel-name #text';
/** Lockup metadata rows that carry text (a badge row such as "CC" does not). The channel row comes first and the
 * counter row ("121K · 4mo ago" behind an icon, or "541 watching") second; a channel's own tabs show only the latter. */
export const META_ROW = `.ytContentMetadataViewModelMetadataRow:has(${META_TEXT})`;
export const META_COUNT_ICON = '.ytContentMetadataViewModelLeadingIcon';
/** A tile in the grid of a channel's own tab (Videos, Shorts, Live): it shows no channel, the page header names it. */
export const CHANNEL_PAGE = 'ytd-browse[page-subtype="channels"]';
export const CHANNEL_TAB_TILE = `${CHANNEL_PAGE} ytd-rich-grid-renderer > #contents > ytd-rich-item-renderer`;
export const CHANNEL_PAGE_NAME = 'yt-page-header-view-model h1';
/** The channel a page is about: the watch page's owner, or the header of the channel page on screen. */
export const WATCH_OWNER_NAME = 'ytd-watch-flexy ytd-watch-metadata #owner ytd-channel-name #text';
export const SHOWN_CHANNEL_NAME = `${CHANNEL_PAGE}:not([hidden]) ${CHANNEL_PAGE_NAME}`;
/** The watch page's description box and its "…more" button. */
export const DESCRIPTION =
  'ytd-watch-flexy ytd-watch-metadata ytd-text-inline-expander#description-inline-expander';
export const DESCRIPTION_MORE = '#expand';
export const SHORTS_ANCHOR = 'a[href^="/shorts/"]';

/** The native 3-dot button. Our dismiss button lives in the same containers, so it is excluded. */
export const MENU_BUTTON = [
  '.ytLockupMetadataViewModelMenuButton button',
  '.shortsLockupViewModelHostOutsideMetadataMenu button',
  'ytd-menu-renderer yt-icon-button button',
  'ytd-menu-renderer button',
  '#menu button',
]
  .map((s) => `${s}:not([ytenrich-dismiss])`)
  .join(', ');
/** Container of an item's 3-dot menu; the dismiss button is inserted as its first child. */
export const MENU_HOST = [
  '.ytLockupMetadataViewModelMenuButton',
  '.shortsLockupViewModelHostOutsideMetadataMenu',
  '#menu:has(> ytd-menu-renderer)',
].join(', ');
export const MENU_ITEM = [
  'ytd-popup-container tp-yt-iron-dropdown yt-list-item-view-model',
  'ytd-popup-container tp-yt-iron-dropdown ytd-menu-service-item-renderer',
].join(', ');
export const MENU_ITEM_CLICK = 'button, tp-yt-paper-item';

/** Shelf containers that can hold a row of Shorts inside a recommendation list. */
const SHELVES = 'grid-shelf-view-model, ytd-reel-shelf-renderer, ytd-rich-shelf-renderer';

/** The watch page's playlist / mix / queue panel: always in the DOM, `[hidden]` while there is none. */
export const PLAYLIST_PANEL = 'ytd-watch-flexy ytd-playlist-panel-renderer#playlist';

/** The watch page's engagement panels (chapters, transcript, …) and its chapter list among them. YouTube keeps two
 * chapter panels; the first is the one it opens. A panel is `display: none` until its `visibility` is EXPANDED. */
export const PANELS = 'ytd-watch-flexy #panels';
export const CHAPTERS_PANEL = `${PANELS} ytd-engagement-panel-section-list-renderer[target-id="engagement-panel-macro-markers-description-chapters"]`;
export const PANEL_EXPANDED = 'ENGAGEMENT_PANEL_VISIBILITY_EXPANDED';

/** Native slots projected into WM panes. `page` is the whole current non-watch page (home, search, channel, feeds, Shorts, anything new);
 * `shorts` is the first Shorts shelf of the watch page's recommendations. */
export const NATIVE_SLOTS = {
  page: 'ytd-page-manager > :not([hidden], ytd-watch-flexy)',
  player: 'ytd-watch-flexy #player-container',
  details: 'ytd-watch-flexy ytd-watch-metadata',
  comments: 'ytd-watch-flexy ytd-comments#comments',
  videos: 'ytd-watch-flexy #related',
  playlist: `${PLAYLIST_PANEL}:not([hidden])`,
  chat: 'ytd-watch-flexy #chat-container',
  chapters: CHAPTERS_PANEL,
  shorts: `ytd-watch-flexy #related :is(${SHELVES}):has(a[href^="/shorts/"])`,
  guide: 'tp-yt-app-drawer#guide #guide-inner-content',
} as const;
export type NativeSlot = keyof typeof NATIVE_SLOTS;

export const MASTHEAD = '#masthead-container';
/** The masthead's left section (hamburger, logo): the workspace switcher follows it, before the search box. */
export const MASTHEAD_START = 'ytd-masthead #start';
export const GUIDE_BUTTON = 'ytd-masthead #guide-button';
export const GUIDE_DRAWER = 'tp-yt-app-drawer#guide';
export const GUIDE_RENDERER = 'tp-yt-app-drawer#guide ytd-guide-renderer';
