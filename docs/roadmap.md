# Roadmap

## North star: YouTube *is* the tiling WM
Every part of youtube.com becomes a view in one tiling layout. Native parts are projected; parts that are
awkward natively are rebuilt as own views. Steps, in order:
1. ~~**WM on every page kind.**~~ Done (2026-11): `page` native view (any page type, Shorts included), layout families `watch`/`browse`. Per-kind layouts only if a real need shows up.
2. **Absorb the masthead.** Add own views: `search` (input + suggestions, navigating via native SPA links where possible), `account`, `notifications` and `create`. Then hide `#masthead-container` and start the host at top 0. Keep a slim fallback (Alt+W restores everything).
3. **Session-wide layout.** A single layout across navigations (player keeps playing in its tile while you browse home/search in another tile, like a miniplayer).
4. i3-style keyboard control (focus/move/split/resize keys, numbered tabs).

## Other
- Safari (App Store): wrap with Xcode's `safari-web-extension-converter`; needs an Apple developer account.
- Add a native view for live chat. (Engagement panels — chapters/transcript — are intentionally not projected.)
- Channel auto-hide rules on top of the `channels` store (Stats → channel row action). Add "Don't recommend channel" to quick-dismiss.
- Stats: weekday × hour heatmap, per-channel period filter (needs day×channel data), a table/CSV view of the charts.
- History: native watch history as a tile (same-origin iframe of `/feed/history`, or the MAIN-world bridge); today History is ytenrich's own record of opens.
- Shorts tile: verify the projected shelf signed in; fall back to an own grid if the shelf DOM proves unstable.
- Option to auto-send "Not interested" for over-exposed videos.
- Compact related-list density options (thumbnail size) in the Videos pane.
- MAIN-world bridge (manifest `world: "MAIN"`) for data-level access (SPA navigation to arbitrary URLs, guide data), only when DOM automation proves fragile.
- Export/import of stats, settings and layouts.
