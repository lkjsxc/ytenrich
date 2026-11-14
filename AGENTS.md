# ytenrich — agent entrypoint

MV3 browser extension (Chromium + Firefox ≥140) that enriches youtube.com:
- recommendation impression stats
- hiding over-exposed unopened videos
- a one-click "Not interested" button
- a tiling window manager (WM) on every page (layout families `watch`, `home`, `channel`, `shorts` and `browse`, each with nine workspaces switched from the masthead; home defaults to ytenrich's recommended Videos and Shorts; Shorts open in the watch player; unknown page types tile as `page`), with ytenrich's own views (recommended Videos/Shorts/Mix lists/Channels/This channel, each with search and its own ▶ settings, Stats/History/Settings/Log) as WM tabs. YouTube's own lists are the views titled "Default · …"
- on YouTube Music (music.youtube.com), the tiling WM only: one layout family `music` for every page, with the app's page, player and Up next panel as tiles (the player's tiles exist while something is loaded)

AI-first repo: no human ergonomics, no backward compatibility, no migrations. Move fast.

## Commands
- `pnpm build`: writes Chromium to `dist/`. `pnpm build --firefox`: writes Firefox to `dist-firefox/`. `pnpm dev`: watch build.
- `pnpm package`: store zips (chromium, firefox, source) from a clean commit → `release/`. `pnpm store-assets`: listing images → `release/store/`.
- [Store releases](docs/store.md#automated-updates): use **Run workflow** in GitHub Actions to preview packages. Pushing a matching `vX.Y.Z` tag on `main` submits that version to the three stores, so push a release tag only when the user asks to submit that version.
- `pnpm bump`: next version; then write the new top section of `store/release-notes.md` (check fails until it matches). Versions are one counter written with dots (`0.2.1`, `0.2.2`, … `0.2.99`, `0.3.0`), up by one per release whatever the size of the change (`scripts/version.ts`).
- `pnpm check`: the canonical gate (repo rules + tsc + biome + vitest). Prints `ok check`. `pnpm fix` auto-formats.
- `pnpm smoke`: live Chromium + extension runs on youtube.com (`scripts/smoke.ts` watch page, `scripts/smoke-browse.ts` search/channel and family switches, `scripts/smoke-music.ts` YouTube Music; launcher in `smoke-lib.ts`). Prints JSON facts and writes `tmp/smoke-*.png`. Read the PNGs to judge layout. It is not canonical (depends on the network and on YouTube). It auto-falls back to the newest cached Chromium; `YTE_CHROME=<path>` overrides.

## Rules (enforced by scripts/check.ts)
- **YouTube DOM names only in `src/youtube/`** (selectors.ts, youtube.css, slots, menu, extract, guide, wait; YouTube Music's in music.ts and music.css). When YouTube changes, fix only there, and refresh `tests/fixtures/` from live DOM.
- No HTML string sinks (`innerHTML` etc.), because YouTube enforces Trusted Types. Build DOM with `src/shared/h.ts`.
- No `class`. Use `create*` factories that return handles with idempotent `dispose`. Prefer pure functions and reducers.
- Every file ≤200 lines. Every long-lived collection documents its bound in a comment.
- No polling. Observe instead (the shared scanner MO/IO, ResizeObserver, YouTube `yt-navigate-finish`).

## Map
- `src/manifest.ts`: manifest (generated into dist).
- `src/background/`: IndexedDB stats owner (`db.ts` schema, `stats-repo.ts` writes, `stats-read.ts` queries) behind the typed protocol in `src/shared/protocol.ts`.
- `src/content/`:
  - `runtime.ts`: shared context.
  - `scanner.ts`: one MO + IO, giving `RecoItem` and `seen` events.
  - `features.ts`: registry.
  - `features/*.ts`: one feature each (`stats` counts what was on screen; `collect` gathers every recommendation on the page for Recommended and lets hidden lists load more).
- `src/wm/`:
  - `layout.ts`: the pure tree. `layout-parse.ts`: validation of stored JSON.
  - `controller.ts`: state, render, persistence.
  - `projector.ts`: native slot positioning.
  - `own-views.ts`: own-view tabs (any number per view). `launcher.ts`: the New tab page behind `+`.
  - `spaces.ts`: workspaces (nine layouts per family). `spaces-bar.ts`: their chips in the masthead. `store.ts`: in-memory mirror of the stored layouts.
  - `render`, `resize`, `tab-drag`, `menus`, `host`, `presets`, `layout-edge`.
- `src/youtube/`: every DOM name. `site.ts` says which app the content script is in (`youtube` or `music`), and the helpers here (`slots`, `guide`, `masthead`) answer for that app, so the WM itself has no site branches. `wm.css` is the tiling CSS both apps get; `youtube.css` or `music.css` follows it.
- `src/views/`: `registry.ts` lists every tab view. Recommended is one mount (`recommended.ts`) with a per-tab spec (`reco-spec.ts`, ▶ `reco-panel.ts`). Native views set `slot`; own views set `mount(el, env)`. Own views run in both the WM and the options page. `views/stats/` is the Stats view (pure period math in `period.ts`; charts are plain flex DOM in `parts.ts`).
- `src/shared/`: h, signal, settings (schema-driven UI), stats-rules, types, log; the ranking in `recommend.ts` + `diversify.ts` + `taste.ts`.
- `docs/architecture.md`: data flow and invariants. `docs/youtube-dom.md`: DOM knowledge and quirks. `docs/features.md`: recipes. `docs/roadmap.md`: next work. `docs/store.md`: store dashboard answers (keep in sync with `PRIVACY.md`). `store/`: the listing text (description, release notes, reviewer notes), sent to AMO on release by `scripts/store-listing.ts`.

## Images
- Users drop raw screenshots in `tmp/` (gitignored). Run `pnpm image tmp/<file> <kebab-name>` to write `docs/images/<name>.webp` (≤1920px wide, WebP). Then delete the raw file.
- Name images `<page>-<feature>[-<variant>]`, e.g. `watch-tiling-dark`. Look at an image before naming it.
- Reference each image from `README.md` exactly once: the hero image at the top, any others in a § Screenshots table. Check enforces .webp only and ≤600KB.

## Work loop
1. Read only the doc/files the task touches. The map above is enough to route.
2. Change code, keeping docs in sync in the same commit.
3. Run `pnpm check`. If the change touches the DOM/WM, also run `pnpm build && pnpm smoke` and inspect the screenshots.
4. Commit with a concise message.
