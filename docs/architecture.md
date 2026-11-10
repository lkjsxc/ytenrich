# Architecture

## Processes
- **Content script** (`content.js`, isolated world, document_start, youtube.com).
  - `createRuntime()` builds: settings signal (chrome.storage.local + onChanged), page signal (URL → PageKind; updated on `yt-navigate-finish`/popstate), scanner, log (ring buffer 200), and `suppressed` id set.
  - Features start from `FEATURES` and each returns a disposer.
- **Background** (`background.js`, service worker / Firefox event page).
  - Sole owner of IndexedDB `ytenrich` (`db.ts`): `videos` by id (indexes `seen`, `opened`, `lastSeen`, `openedAt`, `channel`), `days` by `YYYY-MM-DD` (counters incl. `fresh`/`picked`/`hidden`/`shorts`, `surfaces`, 24 `hours`), `channels` by name (cumulative counters). Upgrades are additive; the v2 upgrade backfills `channels` and `openedAt`.
  - Every write updates video + day + channel rows in one transaction (`stats-repo.ts`). The suppressed-id set is cached in memory per worker lifetime and kept current by each write.
  - Reads (`stats-read.ts`) are bounded index walks: `query` (page of videos; History is `sort: openedAt`; Recommended is `filter: pending, sort: lastSeen`), `overview` (counts + ≤180 days), `channels` (top N).
  - Answers `Api` messages (`src/shared/protocol.ts`): `{ok}` | `{error}` replies.
  - Prunes unopened, unallowed, undismissed rows older than 90 days, and caps the store at 100k rows.
- **Options page** (`options.html`): hosts own views (Stats/Settings/Log) outside YouTube. The toolbar action opens it.

## Data flow
```
YouTube DOM ─MO(childList+href)─► scanner ─onItem─► hide (attr ytenrich-hidden/dim), dismiss button (late menus via onTick)
                                  └─IO≥50%─onSeen─► stats buffer ─2s/pagehide─► bg.record ─► suppressed ids back
page signal (watch/shorts videoId) ─► bg.opened (resets suppression for that id)
```
- An impression means at least 50% visible, counted once per (navigation, video id).
- Suppressed = `seen ≥ hideThreshold && opened==0 && !allowed && !dismissed` (`shared/stats-rules.ts`).
- The hide decision is synchronous at item discovery: the MO callback runs before paint, so there is no flicker. Items already on screen are never hidden mid-view.
- YouTube recycles renderer elements. The scanner keys state by element plus current id/anchor and re-emits on change, so consumers must be idempotent and set *and clear* attributes.

## Consent and settings
- Stats (`statsEnabled`; UI wording is "Enable stats", never "recording") default to off. The first install opens `options.html#welcome` (background `onInstalled`), which explains the record and asks. The Stats view shows the same card (`views/consent.ts`) while recording is off. Store policies require this in-UI disclosure and consent even for local-only data.
- `patchSettings` stores only values that differ from `DEFAULT_SETTINGS`, so later default changes reach settings the user never touched.

## Tiling WM
- Active when `wmEnabled && !fullscreen`; every page kind has a layout family (`wm/presets.ts` `familyOf`): `watch` for watch pages, `shorts` for the Shorts player (projected whole as `page`, with the own `recommended` view beside it by default), `browse` for every other kind. Alt+W toggles it.
- One controller per family (`createWmController(rt, family)`). SPA navigation across families disposes it and creates the other; within a family it only refreshes (and resets the `page` scroll to the top).
- Views declare `families` in the registry (`viewsOf(family)`); a family's layout, `+` menu and stored-layout filter only use its views.
- `html[ytenrich-wm]` gates every WM CSS rule in `youtube/youtube.css`.
- `<ytenrich-root>` is appended to `<body>` (never `<html>`, see Stacking), uses position fixed below the masthead and `z-index:2`, and carries an open shadow root.
  - It contains `.wm` (layout) and `.layer` (menus, drag preview).
  - The root has pointer-events none. Strips, handles, own bodies and menus are auto.
- **Layout** is a pure tree (`wm/layout.ts`): panes hold `tabs: viewId[]`, and each view appears at most once.
  - Persisted at `chrome.storage.local['layout:<family>']` (`shared/layout-store.ts`). Invalid or unknown entries are dropped (`wm/layout-parse.ts`); an empty tree falls back to the preset.
  - Controllers follow `storage.onChanged` for their key: Settings → "Reset tiling layout" deletes the keys, and edits sync across tabs. Our own saves compare equal and are ignored.
  - Tab drags: a pane edge splits, the body joins, and the strip inserts at the caret (`insertAt` → `moveView(..., index)`).
  - Guide: the masthead ☰ is intercepted while tiling. It adds the `guide` view as a left edge pane (`addEdge`, 240px), focuses it if inactive, or closes it if active.
- **Render** rebuilds the DOM on layout change. Own-view mounts persist across re-renders (one per view) and are disposed when their tab closes.
- **Projection**: native YouTube elements (player, metadata, comments, related, chat, guide, and the whole current `page` on browse pages) are *never reparented*.
  - The projector tags them `[ytenrich-slot=view]` and writes inline `!important` left/top/width/height equal to the pane body rect (ResizeObserver plus trusted window resize, rAF-batched).
  - Inactive tabs get `[ytenrich-slot-inactive]` (visibility hidden).
  - A player or page rect change dispatches a synthetic window `resize` (debounced 120ms) so YouTube refits the `<video>` and grids.
  - `#columns` is visibility hidden, so unprojected YouTube content is invisible and inert.
- Stacking: native slots have z-index 1; our host has 2, so the drop preview sits above slots and holes stay transparent. YouTube overlays (masthead 2020, guide drawer + scrim 2030, popups ≈2200) stay above us because the host shares body's stacking context; `body.lock-scrollbar` (drawer/dialog open) makes body `position:fixed`, which would isolate YouTube below a host mounted on `<html>`.

## Stats freshness
- After any mutating call (record/opened/dismissed/allow/clear) the background writes `statsRev` to `chrome.storage.local`, throttled to one write per 1.5s window. `onStatsChanged` (shared/protocol.ts) delivers this to every context.
- The Stats view refreshes on it only while it is visible (IntersectionObserver + `visibilitychange`). Otherwise it marks itself dirty and refreshes when shown.

## Stats view
- `views/stats/index.ts` fetches `overview` + `channels` + `query` together and repaints a section only when its JSON signature changed. Live refreshes are throttled to one per 4s.
- Periods (7/30/90 days) are computed client-side from `overview.days` (`period.ts`: zero-filled series, totals, change vs the previous period).
- Colors: `--s1` (new) and `--s2` (repeats) in `ui/ui.css` are the only series colors; text never uses them.
- Hidden counts: the hide feature bumps `rt.hidden` once per (navigation, id); the stats feature flushes it with `record`.

## Invariants
- Disposal restores YouTube exactly: attributes and inline props are removed, the host is removed, and a resize is dispatched.
- Features never throw into YouTube. Failures go to `rt.log` (shown in the Log tab).
- Stats writes are batched and at most one `record` is in flight per 2s per tab.
