# YouTube DOM knowledge (verified live 2026-11-09, logged out, desktop 1600px)

All names live in `src/youtube/selectors.ts` and `src/youtube/youtube.css`. Fixtures in `tests/fixtures/` are trimmed live captures.

## Items
- Related (watch) items are `yt-lockup-view-model` inside `ytd-watch-next-secondary-results-renderer > ytd-item-section-renderer #contents`.
- Class names are camelCase (`ytLockupViewModel*`), with no `ytd-compact-video-renderer` any more.
- Shorts appear as `grid-shelf-view-model .ytGridShelfViewModelGridShelfItem > ytm-shorts-lockup-view-model-v2 > ytm-shorts-lockup-view-model > a[href^="/shorts/"]`.
- Search uses classic `ytd-video-renderer` (`#video-title`, `ytd-channel-name`) plus shorts grid shelves.
- Home grid cells are `ytd-rich-item-renderer`, which wins as the item root so hiding removes the whole cell.
- Ids come from the href only (`/watch?v=ID`, `/shorts/ID`). Mix links carry `&list=RD…&start_radio=1`, but the id is still `v`.
- Lockup title is `h3[title]`. Channel is the text of the first `.ytContentMetadataViewModelMetadataRow`, but only when a second text row follows and the first has no `.ytContentMetadataViewModelLeadingIcon`: the counter row ("121K · 4mo ago" behind an icon, or "541 watching") comes second, and on a channel's own tabs (Videos, Shorts, Live) it is the only row. Those tiles (`ytd-browse[page-subtype="channels"] ytd-rich-grid-renderer > #contents > ytd-rich-item-renderer`) take the channel from `yt-page-header-view-model h1`, which can render after the first tiles, so it is read again when the tile is recorded. Verified 2026-11-13, also across an in-app move from one channel to another. The thumbnail box is `yt-thumbnail-view-model` .
- `#movie_player` contains end-screen `/watch` anchors, which are excluded via `NOT_RECO`.

## Playlist panel (watch page)
- `ytd-watch-flexy ytd-playlist-panel-renderer#playlist` (in `#secondary-inner`) holds the playlist, mix or queue. It is always in the DOM and carries `[hidden]` while there is none, so the `playlist` slot is that element `:not([hidden])` and `onPlaylistToggle` observes the attribute. Its `#items` list scrolls inside the projected panel. Verified signed out with a mix (`list=RD…`) on 2026-11-10.

## Shorts in Videos (watch page)
- While tiling, the `videos` slot hides Shorts: shelves (`SHELVES`) and single lockups that contain `/shorts/` anchors. The shelf projected as the `shorts` slot is exempt (`:not([ytenrich-slot])`). Unverified signed out (no Shorts appear there); check it signed in.

## Shorts shelf (watch page)
- The `shorts` slot is the first shelf in `#related` that contains `/shorts/` anchors. Projected, it leaves the Videos list (fixed position) and wraps its items to the pane; without the Shorts tab, shelves stay inline in Videos.
- Signed out, watch pages showed no Shorts shelf on 2026-11-10, so the projected shelf CSS (`.ytGridShelfViewModelGridShelf*`) is verified only for the empty state. Check it signed in.
- A native view whose element is missing gets `.body.native.empty` (projector) and shows "Nothing to show here on this page." after 2s.

## Menus
- The item menu button is `.ytLockupMetadataViewModelMenuButton button` (aria-label "More actions"). For shorts, use `.shortsLockupViewModelHostOutsideMetadataMenu button`.
- The popup is `ytd-popup-container > tp-yt-iron-dropdown > … yt-sheet-view-model … yt-list-item-view-model > button[role=menuitem]`.
- Logged-out menus have no "Not interested" (queue / save / offline / share only), so `clickNotInterested` returns `no-item`. This is expected in smoke runs. To exercise the full path signed out, set Settings → extra label to `Share`: ⊘ must open the share dialog of *that* item (verified 2026-11).
- `clickNotInterested` closes any still-open popup first (stale lists would match), waits up to 3s for the items, and returns the visible labels on failure for the Log.
- Menu containers (`MENU_HOST`) host our ⊘ button as their first child, marked `[ytenrich-menu-host]`:
  - Lockups: `.ytLockupMetadataViewModelMenuButton`, absolute at right 0, opacity 0 until hover (`…ShowMenuButtonOnHover`), with radial-gradient `::before/::after` backdrops. We force it visible and drop the backdrops. Vertical (grid) lockups reserve title space for one icon only, so the text container gets an extra 40px margin. Compact (watch) lockups put the menu at the bottom right, so there is no overlap.
  - Shorts: `.shortsLockupViewModelHostOutsideMetadataMenu`, absolute top-right, with a 36px gutter. The button stacks under ⋮ (`column-reverse`).
  - Classic `ytd-video-renderer #menu` (search): `ytd-menu-renderer` stamps *after* the item's anchor appears. Quick-dismiss keeps a bounded pending set retried on `scanner.onTick`. The ⋮ icon button overflows its 24px row upward (aligned via `top:-5px`).
- Labels are matched by normalized text (`i18n-labels.ts`). The user can add an exact label in Settings.

## Watch page
- Tile view counts: list tiles now word them bare ("135K", "31M"; live ones "2.8K watching") in the same metadata spans as the age (`AGE_TEXT`); `extract.ts` `viewsOf` adds "views". Verified 2026-11-14.
- Channel tab bar: `ytd-tabbed-page-header tp-yt-paper-tabs#tabs` is sized from the window and centered with negative margins, so in a narrower tile its start (Home, Videos, Shorts) was cut off; `youtube.css` fits it to the tile and lets `#tabsContainer` scroll sideways. Verified 2026-11-14.
- Description: `ytd-watch-metadata ytd-text-inline-expander#description-inline-expander` gets `[is-expanded]` once open; its `#expand` ("…more") opens it. Owner name: `ytd-watch-metadata #owner ytd-channel-name #text`. Verified 2026-11-13.
- Chapters: engagement panels live in `ytd-watch-flexy #panels` (hidden with the column while tiling). The chapter list is `ytd-engagement-panel-section-list-renderer[target-id="engagement-panel-macro-markers-description-chapters"]`, present twice (the first is the one YouTube opens), with `ytd-macro-markers-list-item-renderer` rows rendered even while closed. Closed it is `display: none` with `visibility="ENGAGEMENT_PANEL_VISIBILITY_HIDDEN"`; the player's `.ytp-chapter-title` and the description's "View all" set `…_EXPANDED`. Videos without chapters have no such panel. Verified 2026-11-13 (seeking from the projected list unverified: pre-roll ads in headless runs).
- A Short plays in the regular player at `/watch?v=<id>` (pillarboxed); `features/shorts.ts` relies on it.
- Chain: `ytd-watch-flexy > #columns > #primary > #primary-inner > #player > #player-container-outer > #player-container-inner > #player-container > ytd-player > #movie_player`.
- Projecting `#player-container` works. YouTube refits the video on window `resize`.
- `#below` contains `ytd-watch-metadata` (details) and `ytd-comments#comments`. Comments lazy-load fine inside a fixed scroll container.
- `#secondary-inner` contains `#panels` (engagement panels: chapters/transcript open here), `#related` and `#chat-container`.
- No ancestor of the slots creates a containing block (transform/contain/filter), so `position:fixed` maps to the viewport. Re-check this when the projection breaks.
- In theater mode YouTube moves `#player-container` into `#full-bleed-container`. Projection targets the element, not the path, so it still works.
- The theme is `html[dark]` (absent means light).
- Opening the guide drawer (or a modal) adds `body.lock-scrollbar` → body `position:fixed` → body becomes a stacking context. Anything of ours that must stack *between* YouTube layers has to live inside body.

## Browse pages (home/search/channel/playlist/feeds)
- `ytd-page-manager` keeps one element per visited page type; inactive ones carry `[hidden]`. The `page` slot is its visible child that is not the watch page (`ytd-browse` for feeds/channels/playlists, `ytd-search`, `ytd-shorts`, and any page type added later).
- `ytd-shorts` fits its player to the tile and keeps its own scroller (`overflow: hidden` on the slot); ArrowDown/Up navigation works (verified 2026-11-10).
- YouTube sizes `ytd-two-column-browse-results-renderer` and chip bars from the *window* width, so they overflow a narrower tile. The page slot is `overflow-x: hidden` and those parts are forced to 100% width. The sticky chip header gets explicit theme backgrounds (it turned white in dark mode when scrolled sideways).
- Dark theme in smokes: cookie `PREF=f6=400` (Playwright `colorScheme` alone leaves `html[dark]` unset).
- Projected whole, it becomes its own scroller. Infinite scroll keeps working (continuations use IntersectionObserver), verified on search and channel videos.
- Parts that are `position:fixed` against window scroll must be unfixed: the channel/playlist `tp-yt-app-header[fixed]` (absolute at the top of its `tp-yt-app-header-layout`, which already reserves its height as padding; it also has `margin-top: masthead`), and the home `#chips-wrapper` (made relative; not verifiable signed out).
- Home parts (`home` family, views `home-videos` / `home-shorts`, both the `page` slot): the feed is `ytd-rich-grid-renderer > #contents` with `ytd-rich-item-renderer` videos, `ytd-rich-section-renderer` shelves and a `ytd-continuation-item-renderer` loader. `[ytenrich-part="videos"]` hides sections containing `/shorts/` anchors; `[ytenrich-part="shorts"]` hides everything except those sections and the loader, and shows the shelf items YouTube keeps `[hidden]` behind "Show more". Signed out, home has no feed, so on 2026-11-10 this was verified only with synthetic feed children. Check it signed in (shelf expansion, and that the loader stops once Shorts fill the tile).
- Home (signed in) sets `ytd-app #frosted-glass` to `with-chipbar`: fixed at top 0, 112px tall, z 2018, backdrop blur. It sits over our tab strips (host z 2), so it is hidden while tiling. The browse smoke forces that mode and hit-tests the strip.
- Feed chip bars live in `ytd-rich-grid-renderer > #header` (home: `ytd-feed-filter-chip-bar-renderer #chips-wrapper`, fixed at `--ytd-rich-grid-chips-bar-top`; channel grids: `chip-bar-view-model`). While tiling, the header is `position: sticky; top: 0` inside the page tile.
- On wide windows the guide drawer is *persistent* there; while tiling it and `ytd-mini-guide-renderer` are hidden unless the guide is projected.

## Guide (hamburger sidebar)
- `tp-yt-app-drawer#guide` (fixed, z 2030, full-viewport box incl. `#scrim`) > `#contentContainer` (absolute, **transform**: translateX(-100%) closed / identity open) > `#guide-wrapper` > `#guide-content` > `#guide-inner-content` (scroller) > `ytd-guide-renderer`.
- Below ~1312px wide YouTube shows `ytd-mini-guide-renderer` and the drawer's `#guide-inner-content` exists *empty*. `resolveSlot('guide')` therefore requires `ytd-guide-renderer`, and the guide is retried with the other required slots. A wake that runs before the masthead exists answers false without memoizing.
- `ytd-guide-renderer` does not exist until the drawer is first opened. `youtube/guide.ts` `wakeGuide()` clicks `ytd-masthead #guide-button` (synthetic, so our interceptor ignores it) while `html[ytenrich-guide-wake]` hides the drawer, waits for the renderer, then closes it.
- While projected (`#guide-inner-content` is the slot), CSS drops the drawer to z 1 and removes `#contentContainer`'s transform (a transform would make it the containing block of our fixed slot).
- The drawer's own close/open toggles the transform and `visibility`. Our slot forces `visibility: visible`, so it survives the closed state.
- Body scroll lock (`body.lock-scrollbar`, position fixed) happens on drawer open, including our wake.

## Collector (hidden lists keep loading)
- YouTube loads the next page of a list when its `ytd-continuation-item-renderer` intersects the viewport (IntersectionObserver; `visibility: hidden` does not matter). `html[ytenrich-harvest]` pins that loader at the viewport's top-left corner for a list the WM is not drawing (`#related`, or any `ytd-page-manager > ytd-browse` page, without `[ytenrich-slot]` or with `[ytenrich-slot-inactive]`). Each loaded page brings a new loader, so loading continues until the attribute goes.
- Verified 2026-11-11 signed out on a watch page: about 150 related videos within 6 s, titles and channels complete. The home feed rule is unverified (no feed signed out); check it signed in.
- Hidden tiles: `visibility: hidden` on a tile or an undrawn page is not enough, because YouTube sets `visibility: visible` on some descendants, and those then show over the tab in front (native tiles sit above the WM host). `youtube.css` hides every descendant too, except a tile drawn from inside (the Shorts shelf in `#related`). Verified 2026-11-11 with a synthetic visible child on home; not yet seen signed in.
- List tiles (Mix, playlist): a `yt-lockup-view-model` with a `yt-collection-thumbnail-view-model` stack, or the classic `ytd-radio-renderer` / `ytd-playlist-renderer` family. Their anchor is `/watch?v=<first video>&list=…`, and the channel line names several artists. Note that ordinary related videos also carry `&list=RD<id>&start_radio=1` when signed out, so the href cannot tell them apart: only the list tile shape makes a Mix (`extractItem`, kind `mix`, keyed by its `RD…` list id). Verified 2026-11-11 on search results; Mix tiles recorded from watch-page related lists 2026-11-13.
- Hidden guide drawer: `tp-yt-app-drawer#guide #contentContainer` keeps a 20px swipe strip along the left window edge that takes clicks; while tiling without the Guide tile it gets `pointer-events: none`.
- Details tile: `#bottom-row > #description` is sized from the window column and overflowed the pane; `youtube.css` caps the description chain at the tile width and wraps the owner/actions rows.
- Channel avatar in a tile: the only `img` from `https://yt3.…`. It is lazy, so it has no `src` until the tile nears the viewport (watch-page related tiles have none at all).

## Masthead
- `ytd-masthead #container` is a flex row of `#start` (hamburger, logo), `#center` (search, `flex: 0 1 732px`) and `#end`. The workspace chips (`<ytenrich-spaces>`) are inserted after `#start` with `flex: 0 0.25 auto; min-width: 76px` and 32px chips: they never stretch (304px at 1600), and on a narrow window `#center` (forced `min-width: 0`) gives up room about four times faster (at 1000px: chips 258, center 292, the bar fades toward its hidden chips). YouTube keeps the foreign element across navigations; `placeInMasthead` puts it back if it ever leaves the document. YouTube's `--yt-spec-*` colour variables are not defined on the masthead, so the chips are themed by `html[dark]`. Verified 2026-11-13.
- A player pane wider than 16:9 shows the poster cropped (`cover`) before playback; once playing, YouTube sizes the video itself to fit, centred.
