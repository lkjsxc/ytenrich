# Roadmap

## North star: YouTube *is* the tiling WM
Every part of youtube.com becomes a view in one tiling layout. Native parts are projected; parts that are
awkward natively are rebuilt as own views. Steps, in order:
1. ~~**WM on every page kind.**~~ Done (2026-11): `page` native view (any page type, Shorts included), layout families `watch`/`browse`. Per-kind layouts only if a real need shows up.
2. **Absorb the masthead.** Add own views: `search` (input + suggestions, navigating via native SPA links where possible), `account`, `notifications` and `create`. Then hide `#masthead-container` and start the host at top 0. Keep a slim fallback (the Settings switch restores everything).
3. ~~**Session-wide layout.**~~ Done (2026-11-18 JST). One watch workspace retains the YouTube-owned player across Home/search/channel/playlist and Back/Forward; Page uses an existing neighbour without changing Player geometry. Native and own-card video selections reuse the tile and restore the selected watch page; carrying playback adds no History/Stats open. All existing saved layouts and nine workspaces per family remain. One Settings switch disables it; Player close, no-neighbour workspaces and Shorts use ordinary behaviour. Logged-out Chromium covers advertisements, actual live content, theatre, watch fullscreen, close/opt-out/workspace fallback and the full capture matrix. Expand the native miniplayer to watch before fullscreen. Remaining coverage: Firefox execution, signed-in accounts, Premium, and individually driving native Next/autoplay and the miniplayer’s own close control.
4. i3-style keyboard control (focus/move/split/resize keys, numbered tabs).

## Other
- Safari (App Store): wrap with Xcode's `safari-web-extension-converter`; needs an Apple developer account.
- Engagement panels: Chapters is projected (`chapters`, optional, comes to the front when YouTube opens it). Transcript is not yet; it opens in the same hidden `#panels` and so is invisible while tiling.
- Channel auto-hide rules on top of the `channels` store (Stats → channel row action). Add "Don't recommend channel" to quick-dismiss.
- Stats: weekday × hour heatmap, per-channel period filter (needs day×channel data), a table/CSV view of the charts.
- History: native watch history as a tile (same-origin iframe of `/feed/history`, or the MAIN-world bridge); History now lists every locally recorded open (0.2.14), with per-video times behind ×N. Older data retains only its latest time per video.
- ~~Recommended/History video cards reload when no native anchor exists.~~ The scoped MAIN router operation now opens validated watch/video-playlist URLs through the native router; existing native anchors still take priority. Ordinary navigation remains the fallback if the router operation is unsupported. The live replacement proof is part of step 3.
- Shorts tile: verify the projected shelf signed in; fall back to an own grid if the shelf DOM proves unstable.
- Option to auto-send "Not interested" for over-exposed videos.
- Compact related-list density options (thumbnail size) in the Videos pane.
- Further MAIN-world access (guide data or other route kinds) needs its own demonstrated DOM limitation. The current bridge is youtube.com-only: selected watch/video-playlist navigation, a native Expand handoff for an already-loaded selected/next video, a gated handoff of the current native history entry, and measured miniplayer sizing. It has no extension-storage access, direct network requests or new host permissions. Native miniplayer activation and cached-watch restoration use DOM events.

## YouTube Music (tiling since 2026-11-14; [friction list](music-ux.md))
- Comments (the app's third side tab) as a tile; Lyrics and Related at once (one element of the app: it needs a second copy or an own view).
- ~~A play record for Music (History, Stats), kept apart from youtube.com's recommendations.~~ Done (2026-11-15, 0.2.14): one open per track start/replay after 10 seconds, metadata from the kept player, separate origin stores, artist/day/hour totals.
- Quick dismiss ("Not interested" on shelves).
- Panes that drop out by window width (a guide saved on a wide window stays on a narrow one).
- Unverified signed in: the Song / Video switch above the player (`#av-id`), Library pages, the account menu, reordering the queue by dragging. Unverified in Firefox (no live smoke there).
- The player bar's ▲ only flips the app's own state while tiling; it could toggle the Player tile instead.

## Left for a stronger model (noted 2026-11-13)
Deliberately kept small in 0.2.10; each needs live DOM work or careful design.
- **Chapters, richer**: highlight the current chapter and follow playback (the `video` element's `timeupdate` is reachable from the content script), chapter markers in the Recommended/History cards, and a Transcript tile (same projection as Chapters, `engagement-panel-searchable-transcript`). Verify that a click in the projected chapter list seeks: headless smokes only ever hit pre-roll ads.
- **Recommendation quality, measured**: the diversity and exploration constants (`shared/diversify.ts`) and evidence weights (`shared/recommend.ts`, `shared/taste.ts`) are reasoned, not fitted. Log per-slot outcomes (shown in Recommended → opened / dismissed / ignored, exploit vs explore slot) locally, show them in Stats, and tune from that; consider per-user adaptive exploration (more while the record is thin).
- **Channel identity**: channels are keyed by display name (two channels can share one, names change). Read the channel handle/id from tiles and pages and key `channels` by it.
- **Shorts without reload**: `features/shorts.ts` still moves to `/watch?v=` with a full page load. The watch-navigation bridge exists; routing Shorts entry through it needs separate proof of the native Shorts/Back behaviour.
- **This channel, fuller**: it lists only videos YouTube already showed you; a channel's uploads could be fetched from its Videos tab (hidden harvest like `collect`).
- **Store screenshots from the repository**: AMO's API takes previews (`POST …/previews/` with `image` and the misspelt `postion`, `DELETE …/previews/<id>/`), so committed screenshots (`pnpm store-assets` output) could replace the listing's on release when they change. Chrome and Edge have no such API. Not done yet because it cannot be tried without the release credentials; the text sync in `scripts/store-listing.ts` is the pattern.
