# Recipes

## Add a feature
1. Create `src/content/features/<id>.ts` exporting `const <id>: Feature = { id, start(rt) { …; return dispose } }`.
2. Register it in `FEATURES` (`src/content/features.ts`).
3. Use `rt.scanner.onItem` for per-recommendation decoration (it must be idempotent: elements are recycled), `rt.scanner.onSeen` for impressions, `rt.page` for navigation, `rt.settings` for config, and `rt.call` for background data.
4. Add settings to `DEFAULT_SETTINGS` and `SETTINGS_SCHEMA` (`src/shared/settings.ts`). The Settings view renders them automatically.
5. Put new YouTube selectors and CSS in `src/youtube/` only.

## Add a WM view (tab)
- **Own view**: write `mountX(el, env) → dispose` in `src/views/x.ts`, then add `{ id, title, hint, mount }` to `VIEWS` (`hint` is its line on the New tab page). Own views can be open several times, so keep per-tab choices in `shared/view-state.ts` under `env.instance` (a `title` field there, or `env.setTitle`, renames the tab). Lists use `views/more.ts`: `keyed` keeps row DOM across refreshes and `autoMore` loads the next page when its sentinel scrolls into view, up to `MAX_ROWS`.
- **Native view**: add a selector to `NATIVE_SLOTS`, then add `{ id, title, slot, families }` to `VIEWS`. Add per-slot CSS in `youtube.css` under `[ytenrich-slot='<slot>']`. Several views may share one slot with different `part` values (`[ytenrich-part]` CSS filters the element, as home's Videos/Shorts tabs do); only one of them is shown at a time.
- Optionally add it to `watchPreset()` / `browsePreset()` (`src/wm/presets.ts`). Users get it from the pane `+` menu either way.

## Add a background method
- Add it to `Api` in `src/shared/protocol.ts`, add a handler in `src/background/index.ts`, and put the DB logic in `stats-repo.ts`.
- Schema change: edit `db.ts` `onupgradeneeded` and bump `DB_VERSION`. Data is wiped (YOLO).

## WM on another page kind
- Generalize `wm` feature gating (page.kind) and the `KEY`/preset in `wm/controller.ts` (per kind).
- Add `<KIND>_SLOTS` in `selectors.ts` and gate CSS on `html[ytenrich-wm='<kind>']`.
