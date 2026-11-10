# Store submission

Keep this file in sync with `PRIVACY.md` and the code. Re-check it whenever a feature starts storing or sending anything new.

## Packages and assets
- `pnpm package` builds from a clean commit and writes to `release/`:
  - `ytenrich-<v>-chromium.zip`: Chrome Web Store, Microsoft Edge Add-ons and Opera add-ons all take the same package.
  - `ytenrich-<v>-firefox.zip`: addons.mozilla.org.
  - `ytenrich-<v>-source.zip`: `git archive` of the commit, for reviewers. AMO and Opera require source for bundled or minified code.
- Bump `package.json` `version` for every upload. Stores reject a version they have already seen.
- `pnpm store-assets` writes to `release/store/` (it uses live YouTube, signed out, English, without autoplay, ads or promo popups):
  - screenshots at 1280×800, light and dark: `1-watch`, `2-search`, `3-stats` and `4-welcome-consent`;
  - `promo-440x280.png` (Chrome Web Store small promo tile);
  - `logo-300.png` (Edge);
  - `icon-128.png`.
- Mozilla's linter passed on 0.1.0 with no errors, warnings or notices: `pnpm dlx web-ext@8 lint --source-dir dist-firefox`. Run it again before each AMO upload.

## Listing text
**Name:** ytenrich

**Summary** (the manifest description, ≤132 chars, localized in `src/_locales`): Tiling layout for every YouTube page, recommendation stats, hiding of repeated recommendations, one-click "Not interested".

**Description (en):**
> ytenrich makes YouTube calmer and more personal.
>
> • Tiling layout on every page except Shorts. On watch pages, the player, details, comments and recommendations sit in resizable panes that scroll on their own. Elsewhere, the page itself sits next to the guide. Drag tabs to split, join or reorder panes. Alt+W turns the layout off and on.
> • Recommendation stats: see which videos YouTube keeps showing you, how often, and which ones you actually opened.
> • Hide over-exposed videos: recommendations shown N times that you never opened are hidden or dimmed.
> • One-click "Not interested": a ⊘ button next to every recommendation's ⋮ menu.
>
> Privacy: recording starts only after you agree, stays in your browser, and is never sent to the developer or anyone else. There are no accounts, analytics or ads. The source is open (Apache-2.0).
>
> ytenrich is not affiliated with, endorsed by or sponsored by YouTube or Google.

**Description (ja):**
> ytenrich は YouTube をもっと落ち着いた、自分好みの場所にします。
>
> • Shorts 以外の全ページをタイル型レイアウトに。再生ページではプレーヤー・概要・コメント・おすすめが、それぞれ独立してスクロールする可変サイズのペインに並びます。それ以外のページでは、ページ本体がガイドの横に並びます。タブをドラッグしてペインを分割・結合・並べ替えできます。Alt+W でオン/オフ。
> • おすすめの統計：YouTube が何度も表示してくる動画と、実際に開いた動画が分かります。
> • 出すぎた動画を非表示：N 回表示されても開かなかったおすすめを非表示または半透明にします。
> • ワンクリック「興味なし」：各おすすめの ⋮ メニューの隣に ⊘ ボタンを表示します。
>
> プライバシー：記録はあなたが同意してから始まり、ブラウザ内にだけ保存され、開発者や第三者には一切送信されません。アカウント・解析・広告はありません。ソースコードは公開されています（Apache-2.0）。
>
> ytenrich は YouTube および Google とは提携しておらず、承認や後援も受けていません。

**Category:**
- Chrome: Tools.
- AMO: Photos, Music & Videos.
- Edge and Opera: Entertainment.

**Homepage and support:** `https://github.com/lkjsxc/ytenrich`; issues: `https://github.com/lkjsxc/ytenrich/issues`.

**Privacy policy URL:** `https://github.com/lkjsxc/ytenrich/blob/main/PRIVACY.md`.

## Chrome Web Store (and Edge or Opera, which ask for a subset of the same)
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
- **Disclosure and consent:** done in the extension. Recording is off by default. The welcome page that opens on install, and the Stats view, explain the record and need an explicit "Start recording" (`src/views/consent.ts`).

## Firefox (addons.mozilla.org)
- `data_collection_permissions: { required: ['none'] }`. Mozilla's data collection means data transmitted outside the add-on or the local browser:
  - stats stay local;
  - "Not interested" only clicks YouTube's own menu, on the user's click;
  - remote thumbnails, the only request carrying user-derived data, are compiled out of the Firefox build (`__FIREFOX__`).
- Private browsing: `incognito: 'not_allowed'`. Mozilla forbids storing data from private sessions.
- **Reviewer notes** (paste into the submission):
  > Source: ytenrich-<v>-source.zip (git archive of the tagged commit). The submitted files are esbuild bundles of the TypeScript in src/.
  > Build: Node.js 24 and pnpm 11.1.2 (`corepack enable`), then `pnpm install --frozen-lockfile && pnpm build --firefox`. The output in dist-firefox/ matches the package.
  > No remote code and no network requests (the optional thumbnails are not in the Firefox build). Data stays in extension storage.
