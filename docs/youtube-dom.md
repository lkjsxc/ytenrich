# YouTube DOM knowledge (verified live 2026-11-09, logged out, desktop 1600px)

All names live in `src/youtube/selectors.ts` and `src/youtube/youtube.css`. Fixtures in `tests/fixtures/` are trimmed live captures.

## Items
- Related (watch) items are `yt-lockup-view-model` inside `ytd-watch-next-secondary-results-renderer > ytd-item-section-renderer #contents`.
- Class names are camelCase (`ytLockupViewModel*`), with no `ytd-compact-video-renderer` any more.
- Shorts appear as `grid-shelf-view-model .ytGridShelfViewModelGridShelfItem > ytm-shorts-lockup-view-model-v2 > ytm-shorts-lockup-view-model > a[href^="/shorts/"]`.
- Search uses classic `ytd-video-renderer` (`#video-title`, `ytd-channel-name`) plus shorts grid shelves.
- Home grid cells are `ytd-rich-item-renderer`, which wins as the item root so hiding removes the whole cell.
- Ids come from the href only (`/watch?v=ID`, `/shorts/ID`). Mix links carry `&list=RD…&start_radio=1`, but the id is still `v`.
- Lockup title is `h3[title]`. Channel is the first `.ytContentMetadataViewModelMetadataRow` text. The thumbnail box is `yt-thumbnail-view-model` (hosts our button and badge).
- `#movie_player` contains end-screen `/watch` anchors, which are excluded via `NOT_RECO`.

## Menus
- The item menu button is `.ytLockupMetadataViewModelMenuButton button` (aria-label "More actions"). For shorts, use `.shortsLockupViewModelHostOutsideMetadataMenu button`.
- The popup is `ytd-popup-container > tp-yt-iron-dropdown > … yt-sheet-view-model … yt-list-item-view-model > button[role=menuitem]`.
- Logged-out menus have no "Not interested" (queue / save / offline / share only), so `clickNotInterested` returns `no-item`. This is expected in smoke runs.
- Labels are matched by normalized text (`i18n-labels.ts`). The user can add an exact label in Settings.

## Watch page
- Chain: `ytd-watch-flexy > #columns > #primary > #primary-inner > #player > #player-container-outer > #player-container-inner > #player-container > ytd-player > #movie_player`.
- Projecting `#player-container` works. YouTube refits the video on window `resize`.
- `#below` contains `ytd-watch-metadata` (details) and `ytd-comments#comments`. Comments lazy-load fine inside a fixed scroll container.
- `#secondary-inner` contains `#panels` (engagement panels: chapters/transcript open here), `#related` and `#chat-container`.
- No ancestor of the slots creates a containing block (transform/contain/filter), so `position:fixed` maps to the viewport. Re-check this when the projection breaks.
- In theater mode YouTube moves `#player-container` into `#full-bleed-container`. Projection targets the element, not the path, so it still works.
- The theme is `html[dark]` (absent means light).
