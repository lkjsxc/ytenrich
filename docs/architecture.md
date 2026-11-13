# Architecture

## Processes
- **Content script** (`content.js`, isolated world, document_start, youtube.com).
  - `createRuntime()` builds: settings signal (chrome.storage.local + onChanged), page signal (URL → PageKind; updated on `yt-navigate-finish`/popstate), scanner, log (ring buffer 200), and `suppressed` id set.
  - Features start from `FEATURES` and each returns a disposer.
- **Background** (`background.js`, service worker / Firefox event page).
  - Sole owner of IndexedDB `ytenrich` (`db.ts`): `videos` by id (indexes `seen`, `opened`, `lastSeen`, `openedAt`, `channel`), `days` by `YYYY-MM-DD` (counters incl. `fresh`/`picked`/`hidden`/`shorts`, `surfaces`, 24 `hours`), `channels` by name (cumulative counters). Upgrades are additive; the v2 upgrade backfills `channels` and `openedAt`.
  - Every write updates video + day + channel rows in one transaction (`stats-repo.ts`). The suppressed-id set is cached in memory per worker lifetime and kept current by each write.
  - Reads (`stats-read.ts`) are bounded index walks: `query` (page of videos; History is `sort: openedAt`; Recommended is `filter: pending, sort: lastSeen`), `overview` (counts + every day on record; the Stats view's "All time" period charts them in ≤120 buckets), `channels` (top N).
  - Answers `Api` messages (`src/shared/protocol.ts`): `{ok}` | `{error}` replies.
  - Prunes unopened, unallowed, undismissed rows older than 90 days, and caps the store at 100k rows.
- **Recommended** (`views/recommended.ts`, `recommend` message with a `RecoQuery`, `background/recommend.ts`): each tab has its own spec (`views/reco-spec.ts`, kept in its view state, edited in the ⚙ panel `views/reco-panel.ts`): kinds (video / short / mix), scope (every channel, the page's channel from `rt.channel`, or one named channel), order (`ranked` or `newest`), grouping by channel, and whether opened videos are included. The pool is the newest 2000 matching, undismissed, not over-exposed rows (a channel's own rows through the `channel` index when scoped). `ranked` scores them with `shared/recommend.ts` (pure, tested): channel liking weighed by evidence (one open ≈ ×1.6 over an unknown channel, a dozen ≈ ×3; shown often and never opened sinks to no less than ×0.6; dismissals divide) × freshness (half-life 2 days) × YouTube's insistence ÷ repeated unopened impressions.
  - Title taste (`shared/taste.ts`, pure, tested): per-token log-odds of opened titles against passed-over and dismissed ones, CJK text as character pairs, scaled by `opened / (opened + 15)` so a new user's first opens are hints, then clamped to ×0.5–2. Learned per query from the last 400 opened titles, rows shown twice or more, and dismissed rows.
  - Diversity (`shared/diversify.ts`, pure, tested): a greedy re-rank of the first 1000 slots. Each slot takes the best candidate after penalties: ×0.6 per earlier pick of its channel and ×0.7 per pick of it among the last three, title overlap (Jaccard) with the last six picks (down to ×0.35), and ×0.85 per recent pick offered on the same page view (surface + 2-minute bucket). Every fifth slot ranks by YouTube's signals alone (`exploreScore`: freshness, insistence, fatigue, channel dismissals), so the list keeps sampling beyond what the record favors instead of settling into a local optimum. Penalties only lower values, so each slot's scan stops at the first candidate that cannot win.
  - Mix tiles (`LIST_TILE` with a `list=RD…` link) are items of kind `mix` keyed by their list id, with `video` holding the video they open with (thumbnail, link) and no channel. Playlist tiles are not items. A Mix counts as opened once per tab when a watch page plays a list whose tile was seen (`content/features/stats.ts`).
- **Over-exposure** (`isSuppressed` in `shared/stats-rules.ts`, state in `background/suppress.ts`): off by default (`hideMode: off` makes the background's threshold Infinity, so nothing is suppressed or held back from Recommended). A video is over-exposed when unopened, undismissed, shown `hideThreshold` times (3× for channels opened 3+ times), with first and last sighting more than a day apart and the last within 30 days. `query` returns the over-exposed ids of its page, since views cannot judge without the liked channels.
- **Collector** (`content/features/collect.ts`, `offer` message; setting `collect`, default `more`): every scanned item is offered once per navigation, seen or not (`applyOffer` writes the video row and bumps `lastSeen`; `seen`, days and channels stay impression-only, so over-exposure hiding is unaffected). The reply says whether the stock is low (`wanted`: under 1500 unopened candidates from the last 72 h). While it is, the setting is `more`, the tab is visible and the navigation has gathered under 300 items (80 when the stock is full, so every kind of page keeps contributing), `html[ytenrich-harvest]` is set, and `youtube.css` then pins the loader of an undrawn `#related` or any undrawn `ytd-browse` page (home, subscriptions, channel) inside the viewport so YouTube loads its next page. `seen` needs real visibility: the scanner's IO checks `checkVisibility` and re-tests in-view items when a slot attribute changes.
- **Upload age**: `ageOf` (youtube/extract.ts) reads the tile's age text late (at seen or flush time), `shared/age.ts` parses English and Japanese wording, and the first estimate is kept as `published`. Recommended shows it beside the channel.
- **Caches in the background** (`background/recommend.ts`): the ranking of each query (up to 8) is kept until a mutating message or a settings change (at most a minute), so list refreshes and further pages cost one slice; the stock answer for collectors is kept 20 s.
- **Backup** (`shared/backup.ts`, Settings → Export / Import data): one JSON file `{ app, format, exportedAt, storage, stats }`. `storage` is the `settings`, `layout:*` and `view:*` keys; `stats` is the three DB stores, read and written in pages through the `dump` / `restore` messages (`background/backup.ts`, which repairs rows to the current shape and prunes afterwards). Import validates the file, then replaces everything.
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
- Stats (`statsEnabled`) default to on. Installing opens youtube.com (background `onInstalled`); every Recommended tab shows the welcome card (`views/consent.ts` `introCard`: what is recorded, the switch, "Got it") until `introDone`. `options.html#welcome` still exists for store screenshots. The Stats view shows `statsCard` while stats are off.
- `patchSettings` stores only values that differ from `DEFAULT_SETTINGS`, so later default changes reach settings the user never touched.

## Tiling WM
- Active when `wmEnabled && !fullscreen`; every page kind has a layout family (`wm/presets.ts` `familyOf`): `watch` for watch pages, `home` for the home feed (default: the own `recommended` and `recommended-shorts` views; the `page` element has two part views, `home-videos` and `home-shorts`, that take turns), `channel` for channel pages (guide | `page` | `channel-videos`), `shorts` for the Shorts player (projected whole as `page`; with `shortsAsVideos`, the default, `content/features/shorts.ts` sends Shorts links and arrivals to `/watch?v=` instead), `browse` for every other kind. There is no shortcut to switch tiling off; Settings has the switch.
- The page's channel (`rt.channel`, `youtube/extract.ts` `pageChannel`): the watch page's owner or the shown channel page's header, re-read on scanner ticks. The `channel-videos` view ("This channel") follows it.
- Chapters (`chapters` view, optional): the projected chapter panel (CSS forces it shown and drops its header). `youtube/slots.ts` `onChaptersOpen` watches `visibility` in `#panels`; when YouTube opens chapters the controller brings the tab to the front (or adds it beside Details). Optional views re-check on playlist toggles and on scanner ticks (a chapter panel comes and goes with the video).
- `content/features/details.ts` (`expandDetails`): for 10 s after each watch navigation, clicks the description's `#expand` while the box lacks `is-expanded`, once.
- One controller per family (`createWmController(rt, family)`). SPA navigation across families disposes it and creates the other; within a family it only refreshes (and resets the `page` scroll to the top).
- Views declare `families` in the registry (`viewsOf(family)`); a family's layout, `+` menu and stored-layout filter only use its views.
- `html[ytenrich-wm]` gates every WM CSS rule in `youtube/youtube.css`.
- `<ytenrich-root>` is appended to `<body>` (never `<html>`, see Stacking), uses position fixed below the masthead and `z-index:2`, and carries an open shadow root.
  - It contains `.wm` (layout) and `.layer` (menus, drag preview).
  - The root has pointer-events none. Strips, handles, own bodies and menus are auto.
- **Layout** is a pure tree (`wm/layout.ts`): panes hold `tabs: viewId[]`, and each view appears at most once.
  - Tab ids are `<view id>` or `<view id>~<n>` (`views/registry.ts` `kindOf`, `freshTab`): native views exist once, own views any number of times. `wm/own-views.ts` mounts own tabs lazily per id and gives each `env.instance` (`<family>:<tab id>`), the key of its saved state (`shared/view-state.ts`, `chrome.storage.local['view:<instance>']`).
  - Optional native views (`optional: true`, the watch page's `playlist`): `wm/optional.ts` draws the layout without their tab while YouTube has no such element, and re-renders when it appears or goes. The stored layout keeps the tab. Views added to a preset later (`LATE`) are inserted once into layouts saved before they existed (`chrome.storage.local.introduced`).
  - `+` adds a New tab page (`wm/launcher.ts`, tab kind `new`): a filterable card list of the family's views. Picking one replaces that tab in place (`L.replaceView`); a native view that is open elsewhere moves there.
  - One projector (`wm/projector.ts`) lives in the WM feature and is handed to each controller: a workspace switch disposes the old controller and creates the next in one task, and the next one re-projects the same elements, so YouTube never sees them released (released, the player refits to its default size for a frame). It releases only when tiling stops (off, fullscreen).
  - Look: `uiScale` zooms only `.strip`, `.view` and `.menu` (CSS `zoom`, so pane geometry and projection stay in real pixels; the menu divides its own offsets by the zoom). `tabWidth` fixes the tab width (0 = fit the title). Key events from fields in the shadow root are stopped at the root, or YouTube's hotkeys would fire while typing.
  - **Workspaces** (`wm/spaces.ts`): every family has 9 layouts and shows one. `layout:<family>:spaces` stores `{ active }`, each tab's own choice, read only as the start for the next page. `content/features/wm.ts` owns the choice and recreates the controller on a switch; the chips (`wm/spaces-bar.ts`) are placed in the masthead by `youtube/masthead.ts`. Presets per workspace are in `wm/presets.ts` (those without one start as a New tab page).
  - `wm/store.ts` mirrors every `layout:*` key in memory and is read before the first controller exists, so a controller starts on its saved layout and no default is drawn first. It debounces writes, flushes them on `pagehide` and on dispose, and tells a controller only about changes made elsewhere.
  - Persisted at `chrome.storage.local['layout:<family>']` for workspace 1 and `['layout:<family>:<n>']` for the others (`shared/layout-store.ts`). Invalid or unknown entries are dropped (`wm/layout-parse.ts`); an empty tree falls back to the preset.
  - Controllers follow their key through the store: Settings → "Reset tiling layout" deletes the keys, and edits sync across tabs. Our own saves compare equal and are ignored.
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
- After any mutating call (record/offer/opened/dismissed/clear/restore) the background writes `statsRev` to `chrome.storage.local`, throttled to one write per 1.5s window. `onStatsChanged` (shared/protocol.ts) delivers this to every context.
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

## Tab bar
- Names: the Recommended views (`recommended`, `recommended-shorts`, `recommended-mixes`, `recommended-channels`, `channel-videos`; one mount with a different starting spec) are titled after their spec (`specTitle`: Videos / Shorts / Mixes / Channels / This channel / a channel's name), and a tab renames itself when its ⚙ settings change. Their only chrome is ⚙; no view repeats its tab's name as a heading. YouTube's own lists are "Default · Videos" / "Default · Shorts".
- Closing takes `closeClicks` clicks on × (default 3; `wm/render.ts` `closeButton`): each click fills a ring (`--p`, a registered property so it animates) and the count resets after 2.5 s.
- Scale: `.strip` zooms by `uiScale × tabScale` (defaults 1 and 1.2); views and menus by `uiScale`.
- Overflow: the bar scrolls sideways (wheel too) and shows an accent glow on a side with more tabs, done with background attachment (`scroll` glow under a `local` cover), no script.
- Resize handles are 5px lines with a `::before` that extends the grab area 5px to each side.
- Channel avatars: `collect` reads a tile's `yt3.*` image at flush time (avatars load lazily) and `offer` stores it on the channel row (`isAvatarUrl` guards the host). Shown in Recommended · Channels when images are on.
