# Architecture

## Processes
- **Content script** (`content.js`, isolated world, document_start, youtube.com).
  - `createRuntime()` builds: settings signal (chrome.storage.local + onChanged), page signal (URL → PageKind; updated on `yt-navigate-finish`/popstate), scanner, log (ring buffer 200), and `suppressed` id set.
  - Features start from `FEATURES` and each returns a disposer.
- **Background** (`background.js`, service worker / Firefox event page).
  - Sole owner of IndexedDB `ytenrich` (`videos` keyed by id, with indexes `seen` and `lastSeen`; `days` keyed by `YYYY-MM-DD`).
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

## Tiling WM
- Active only when `wmEnabled && page.kind==='watch' && !fullscreen`. Alt+W toggles it.
- `html[ytenrich-wm]` gates every WM CSS rule in `youtube/youtube.css`.
- `<ytenrich-root>` is appended to `<body>` (never `<html>`, see Stacking), uses position fixed below the masthead and `z-index:2`, and carries an open shadow root.
  - It contains `.wm` (layout) and `.layer` (menus, drag preview).
  - The root has pointer-events none. Strips, handles, own bodies and menus are auto.
- **Layout** is a pure tree (`wm/layout.ts`): panes hold `tabs: viewId[]`, and each view appears at most once.
  - Persisted at `chrome.storage.local['layout:watch']` (`shared/layout-store.ts`). Invalid or unknown entries are dropped (`wm/layout-parse.ts`); an empty tree falls back to the preset.
  - Controllers follow `storage.onChanged` for their key: Settings → "Reset tiling layout" deletes the keys, and edits sync across tabs. Our own saves compare equal and are ignored.
  - Tab drags: a pane edge splits, the body joins, and the strip inserts at the caret (`insertAt` → `moveView(..., index)`).
  - Guide: the masthead ☰ is intercepted while tiling. It adds the `guide` view as a left edge pane (`addEdge`, 240px), focuses it if inactive, or closes it if active.
- **Render** rebuilds the DOM on layout change. Own-view mounts persist across re-renders (one per view) and are disposed when their tab closes.
- **Projection**: native YouTube elements (player, metadata, comments, related, chat) are *never reparented*.
  - The projector tags them `[ytenrich-slot=view]` and writes inline `!important` left/top/width/height equal to the pane body rect (ResizeObserver plus trusted window resize, rAF-batched).
  - Inactive tabs get `[ytenrich-slot-inactive]` (visibility hidden).
  - A player rect change dispatches a synthetic window `resize` (debounced 120ms) so YouTube refits the `<video>`.
  - `#columns` is visibility hidden, so unprojected YouTube content is invisible and inert.
- Stacking: native slots have z-index 1; our host has 2, so the drop preview sits above slots and holes stay transparent. YouTube overlays (masthead 2020, guide drawer + scrim 2030, popups ≈2200) stay above us because the host shares body's stacking context; `body.lock-scrollbar` (drawer/dialog open) makes body `position:fixed`, which would isolate YouTube below a host mounted on `<html>`.

## Stats freshness
- After any mutating call (record/opened/dismissed/allow/clear) the background writes `statsRev` to `chrome.storage.local`, throttled to one write per 1.5s window. `onStatsChanged` (shared/protocol.ts) delivers this to every context.
- The Stats view refreshes on it only while it is visible (IntersectionObserver + `visibilitychange`). Otherwise it marks itself dirty and refreshes when shown.

## Invariants
- Disposal restores YouTube exactly: attributes and inline props are removed, the host is removed, and a resize is dispatched.
- Features never throw into YouTube. Failures go to `rt.log` (shown in the Log tab).
- Stats writes are batched and at most one `record` is in flight per 2s per tab.
