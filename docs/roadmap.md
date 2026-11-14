# Roadmap

## North star: YouTube *is* the tiling WM
Every part of youtube.com becomes a view in one tiling layout. Native parts are projected; parts that are
awkward natively are rebuilt as own views. Steps, in order:
1. ~~**WM on every page kind.**~~ Done (2026-11): `page` native view (any page type, Shorts included), layout families `watch`/`browse`. Per-kind layouts only if a real need shows up.
2. **Absorb the masthead.** Add own views: `search` (input + suggestions, navigating via native SPA links where possible), `account`, `notifications` and `create`. Then hide `#masthead-container` and start the host at top 0. Keep a slim fallback (the Settings switch restores everything).
3. **Session-wide layout.** A single layout across navigations (player keeps playing in its tile while you browse home/search in another tile, like a miniplayer).
4. i3-style keyboard control (focus/move/split/resize keys, numbered tabs).

## Other
- Safari (App Store): wrap with Xcode's `safari-web-extension-converter`; needs an Apple developer account.
- Engagement panels: Chapters is projected (`chapters`, optional, comes to the front when YouTube opens it). Transcript is not yet; it opens in the same hidden `#panels` and so is invisible while tiling.
- Channel auto-hide rules on top of the `channels` store (Stats → channel row action). Add "Don't recommend channel" to quick-dismiss.
- Stats: weekday × hour heatmap, per-channel period filter (needs day×channel data), a table/CSV view of the charts.
- History: native watch history as a tile (same-origin iframe of `/feed/history`, or the MAIN-world bridge); today History is ytenrich's own record of opens.
- Recommended view opens videos with a full page load when no native anchor exists (needs the MAIN-world bridge for SPA navigation).
- Shorts tile: verify the projected shelf signed in; fall back to an own grid if the shelf DOM proves unstable.
- Option to auto-send "Not interested" for over-exposed videos.
- Compact related-list density options (thumbnail size) in the Videos pane.
- MAIN-world bridge (manifest `world: "MAIN"`) for data-level access (SPA navigation to arbitrary URLs, guide data), only when DOM automation proves fragile.

## Left for a stronger model (noted 2026-11-13)
Deliberately kept small in 0.2.10; each needs live DOM work or careful design.
- **Chapters, richer**: highlight the current chapter and follow playback (the `video` element's `timeupdate` is reachable from the content script), chapter markers in the Recommended/History cards, and a Transcript tile (same projection as Chapters, `engagement-panel-searchable-transcript`). Verify that a click in the projected chapter list seeks: headless smokes only ever hit pre-roll ads.
- **Recommendation quality, measured**: the diversity and exploration constants (`shared/diversify.ts`) and evidence weights (`shared/recommend.ts`, `shared/taste.ts`) are reasoned, not fitted. Log per-slot outcomes (shown in Recommended → opened / dismissed / ignored, exploit vs explore slot) locally, show them in Stats, and tune from that; consider per-user adaptive exploration (more while the record is thin).
- **Channel identity**: channels are keyed by display name (two channels can share one, names change). Read the channel handle/id from tiles and pages and key `channels` by it.
- **Shorts without reload**: `features/shorts.ts` moves to `/watch?v=` with a full page load. SPA navigation needs the MAIN-world bridge.
- **This channel, fuller**: it lists only videos YouTube already showed you; a channel's uploads could be fetched from its Videos tab (hidden harvest like `collect`).
- **Store screenshots from the repository**: AMO's API takes previews (`POST …/previews/` with `image` and the misspelt `postion`, `DELETE …/previews/<id>/`), so committed screenshots (`pnpm store-assets` output) could replace the listing's on release when they change. Chrome and Edge have no such API. Not done yet because it cannot be tried without the release credentials; the text sync in `scripts/store-listing.ts` is the pattern.
