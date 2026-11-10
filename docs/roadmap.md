# Roadmap

## North star: YouTube *is* the tiling WM
Every part of youtube.com becomes a view in one tiling layout. Native parts are projected; parts that are
awkward natively are rebuilt as own views. Steps, in order:
1. ~~**WM on every page kind.**~~ Done (2026-11): `page` native view, layout families `watch`/`browse`. Open: Shorts pages still use YouTube's UI; per-kind layouts only if a real need shows up.
2. **Absorb the masthead.** Add own views: `search` (input + suggestions, navigating via native SPA links where possible), `account`, `notifications` and `create`. Then hide `#masthead-container` and start the host at top 0. Keep a slim fallback (Alt+W restores everything).
3. **Session-wide layout.** A single layout across navigations (player keeps playing in its tile while you browse home/search in another tile, like a miniplayer).
4. i3-style keyboard control (focus/move/split/resize keys, numbered tabs).

## Other
- Safari (App Store): wrap with Xcode's `safari-web-extension-converter`; needs an Apple developer account.
- Add a native view for live chat. (Engagement panels — chapters/transcript — are intentionally not projected.)
- Channel-level stats (most-pushed channels) and channel auto-hide rules. Add "Don't recommend channel" to quick-dismiss.
- Option to auto-send "Not interested" for over-exposed videos.
- Compact related-list density options (thumbnail size) in the Videos pane.
- MAIN-world bridge (manifest `world: "MAIN"`) for data-level access (SPA navigation to arbitrary URLs, guide data), only when DOM automation proves fragile.
- Export/import of stats, settings and layouts.
