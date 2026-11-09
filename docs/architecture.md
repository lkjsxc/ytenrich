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
YouTube DOM ─MO(childList+href)─► scanner ─onItem─► hide (attr ytenrich-hidden/dim), dismiss button, count badge
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
- `<ytenrich-root>` is appended to `<html>`, uses position fixed below the masthead and `z-index:2`, and carries an open shadow root.
  - It contains `.wm` (layout) and `.layer` (menus, drag preview).
  - The root has pointer-events none. Strips, handles, own bodies and menus are auto.
- **Layout** is a pure tree (`wm/layout.ts`): panes hold `tabs: viewId[]`, and each view appears at most once.
  - Persisted at `chrome.storage.local['layout:watch']`. Invalid or unknown entries are dropped; an empty tree falls back to the preset.
- **Render** rebuilds the DOM on layout change. Own-view mounts persist across re-renders (one per view) and are disposed when their tab closes.
- **Projection**: native YouTube elements (player, metadata, comments, related, panels, chat) are *never reparented*.
  - The projector tags them `[ytenrich-slot=view]` and writes inline `!important` left/top/width/height equal to the pane body rect (ResizeObserver plus trusted window resize, rAF-batched).
  - Inactive tabs get `[ytenrich-slot-inactive]` (visibility hidden).
  - A player rect change dispatches a synthetic window `resize` (debounced 120ms) so YouTube refits the `<video>`.
  - `#columns` is visibility hidden, so unprojected YouTube content is invisible and inert.
- Stacking: native slots have z-index 1; our host has 2, so the drop preview sits above slots and holes stay transparent. YouTube popups (z≈2200) stay above everything.

## Invariants
- Disposal restores YouTube exactly: attributes and inline props are removed, the host is removed, and a resize is dispatched.
- Features never throw into YouTube. Failures go to `rt.log` (shown in the Log tab).
- Stats writes are batched and at most one `record` is in flight per 2s per tab.
