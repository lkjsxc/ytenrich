# Store submission facts

Keep these answers in sync with `PRIVACY.md` and the code. Re-check them when a feature starts storing or sending anything new.

## Chrome Web Store (developer dashboard)
- **Single purpose:** make youtube.com more personal and comfortable by adding a tiling layout and controls for recommendations (statistics, hiding repeated recommendations, one-click "Not interested").
- **Permission justifications:**
  - `storage`: settings and pane layouts.
  - `unlimitedStorage`: the local recommendation-statistics database (IndexedDB, capped at 100,000 videos).
  - Host `https://www.youtube.com/*`: the content script that provides the layout and the recommendation features on YouTube pages.
- **Remote code:** none. All code is bundled.
- **Data usage (privacy practices form):** handled locally only, never transmitted to the developer.
  - Web history: recommended and opened YouTube videos.
  - Website content: video titles and channel names.
  - User activity: opens and "Not interested" clicks.
  - Certify all three: no sale, no use unrelated to the single purpose, no creditworthiness use.
- **Privacy policy URL:** `https://github.com/lkjsxc/ytenrich/blob/main/PRIVACY.md`.
- **Disclosure and consent:** the policy requires an in-extension disclosure and the user's affirmative consent before user data is handled, *even data kept only on the device*. Recording on by default without such a prompt is a review risk; see the open item in `roadmap.md`.

## Firefox (addons.mozilla.org)
- `data_collection_permissions: { required: ['none'] }`. Mozilla's data collection is data transmitted outside the add-on or the local browser.
  - Stats stay local.
  - "Not interested" only clicks YouTube's own menu, on the user's click.
  - Remote thumbnails, the only request with user-derived data, are compiled out of the Firefox build (`__FIREFOX__`).
- Private browsing: `incognito: 'not_allowed'`. Mozilla forbids storing data from private sessions.
