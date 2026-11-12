# Store submission

Keep this file in sync with `PRIVACY.md` and the code. `docs/store-update-prompt.md` is a ready prompt for an agent that updates the three dashboards from this file. Re-check it whenever a feature starts storing or sending anything new.

## Packages and assets
- `pnpm package` builds from a clean commit and writes to `release/`:
  - `ytenrich-<v>-chromium.zip`: Chrome Web Store, Microsoft Edge Add-ons and Opera add-ons all take the same package.
  - `ytenrich-<v>-firefox.zip`: addons.mozilla.org.
  - `ytenrich-<v>-source.zip`: `git archive` of the commit, for reviewers. AMO and Opera require source for bundled or minified code.
- Versions are a single counter that goes up by one per release, written with dots: `0.2.1` → `0.2.2` → … → `0.2.99` → `0.3.0`. No part is a "major" or "minor"; never skip ahead for a big change. `pnpm bump` writes the next one. The same spelling is used in `package.json`, both manifests, the tag (`v0.2.1`) and every store. Stores reject a version they have already seen, so bump for every upload.
- `pnpm store-assets` writes to `release/store/` (it uses live YouTube, signed out, English, without autoplay, ads or promo popups):
  - screenshots at 1280×800, light and dark: `1-watch`, `2-search`, `3-stats` and `4-welcome-consent`;
  - `promo-440x280.png` (Chrome Web Store small promo tile);
  - `logo-300.png` (Edge);
  - `icon-128.png`.
- The red rounded icon in `src/icon.svg` is the source for every browser icon and store logo. `pnpm store-assets --branding-only` refreshes the logos and promotional tile without recapturing screenshots.
- To check the Firefox package locally, run `pnpm dlx web-ext@10.8.0 lint --source-dir dist-firefox`. AMO also validates the package during submission. The desktop-only manifest may produce a warning about Firefox for Android 140 and the data consent manifest key.

## Automated updates

The **Browser stores** GitHub Actions workflow uses `pnpm check` and `pnpm package`. **Run workflow** builds downloadable ZIPs without credentials. A push of `vX.Y.Z` to GitHub submits an update for the existing Chrome, Edge and Firefox listings. The tag must match `package.json` and point to a commit on `main`. The version for both browser manifests comes from `package.json`.

### One-time setup

1. Wait for the initial versions to be published. In [GitHub Environments](https://github.com/lkjsxc/ytenrich/settings/environments), use the `browser-stores` environment and restrict deployment to tags matching `v*`.
2. For Chrome, enable the Chrome Web Store API and IAM Service Account Credentials API in a Google Cloud project. Create a service account and [link its email](https://developer.chrome.com/docs/webstore/service-accounts) in the Chrome developer dashboard. Set up [GitHub OIDC with Google Cloud Workload Identity Federation](https://docs.github.com/en/actions/how-tos/secure-your-work/security-harden-deployments/oidc-in-google-cloud-platform). Map `attribute.repository_id=assertion.repository_id` alongside `google.subject=assertion.sub`. Grant the repository's principal set for `attribute.repository_id/1451180403` the `roles/iam.workloadIdentityUser` role on that service account. Use this provider condition:

   ```text
   assertion.repository_id == '1451180403' &&
   assertion.environment == 'browser-stores' &&
   assertion.event_name == 'push' &&
   assertion.workflow_ref.startsWith('lkjsxc/ytenrich/.github/workflows/store-release.yml@refs/tags/v')
   ```

   Add these environment **variables**:
   - `CHROME_WIF_PROVIDER` — `projects/PROJECT_NUMBER/locations/global/workloadIdentityPools/POOL/providers/PROVIDER`
   - `CHROME_SERVICE_ACCOUNT` — the linked service account email
3. In [Edge Partner Center](https://partner.microsoft.com/dashboard/microsoftedge/overview), open **Publish API** and use the current API key experience. Save the client ID and API key as environment **secrets** `EDGE_CLIENT_ID` and `EDGE_API_KEY`. Renew the key when it expires.
4. In [Firefox Add-ons API Credentials](https://addons.mozilla.org/en-US/developers/addon/api/key/), use credentials from an account that can manage ytenrich. Save the JWT issuer and secret as environment **secrets** `AMO_API_KEY` and `AMO_API_SECRET`.

The workflow requests a short-lived Chrome token. Enter the Edge and Firefox secrets directly in GitHub's environment settings.

### Release

1. Run `pnpm bump` and land it with the release changes on `main`. Check the listing and privacy declarations in each store when data handling, permissions or listing text change. This workflow submits packages to the existing listings. Use the dashboards to update listing details and privacy declarations.
2. When ready to submit, push one matching tag at a time from the intended commit on `main`. For example, for version `0.1.1`:

   ```sh
   git tag v0.1.1
   git push origin refs/tags/v0.1.1
   ```

3. The same tag publishes a [GitHub release](https://github.com/lkjsxc/ytenrich/releases) with `ytenrich-chromium.zip`, `ytenrich-firefox.zip` (fixed names, so README's `releases/latest/download/…` links always give the newest) and the source ZIP. It does not wait for the stores.
4. Check the three submission jobs under [Actions](https://github.com/lkjsxc/ytenrich/actions/workflows/store-release.yml) and the review status in each store dashboard. Firefox submits its source ZIP alongside the extension. The jobs finish when submissions are accepted for review.
5. For a partial failure, check the affected dashboard first. If the version is still unsubmitted, correct the cause and use **Re-run failed jobs**. Chrome and Firefox check for an existing submission of the same version. For Edge, verify a timed-out upload or publish using the operation ID in the job log and the status in Partner Center before rerunning. Use the original ZIP to finish any confirmed draft in the dashboard if the store rejects a repeated upload. If a store rejects the version and the code needs a fix, release a new version.

API references: [Chrome Web Store v2](https://developer.chrome.com/docs/webstore/using-api/), [Edge Add-ons v1.1](https://learn.microsoft.com/en-us/microsoft-edge/extensions/update/api/using-addons-api), [Firefox Add-ons](https://mozilla.github.io/addons-server/topics/api/addons.html#version-create).

## Build of main
`.github/workflows/build.yml` runs on every push to `main`: `pnpm check`, `pnpm package`, then it keeps `dist/` and `dist-firefox/` as the run's artifacts `ytenrich-chromium` and `ytenrich-firefox` (downloadable from the run page by signed-in GitHub users, kept 90 days). It touches neither the stores nor GitHub releases, which hold versions only.

## Listing text

All store listings are English only. Keep English as the default and remove other listing locales, including Japanese. Package metadata lives only in `src/_locales/en/messages.json`; do not reintroduce other `_locales` directories. Store navigation may still follow the visitor's language; the extension's listing text stays English.
**Name:** ytenrich

**Summary** (the manifest description, ≤132 chars, English only in `src/_locales/en/messages.json`): Tiling layout for every YouTube page, recommendation stats, hiding of repeated recommendations, one-click "Not interested".

**Description (en):**
> ytenrich makes YouTube calmer and more personal.
>
> • Tiling layout on every page, Shorts included. On watch pages, the player, details, comments and recommendations sit in resizable panes that scroll on their own. Elsewhere, the page itself sits next to the guide. Drag tabs to split, join or reorder panes. Alt+W turns the layout off and on.
> • Recommendation stats: see which videos YouTube keeps showing you, how often, and which ones you actually opened.
> • Hide over-exposed videos (optional): recommendations YouTube keeps showing for more than a day that you never open can be hidden or dimmed.
> • One-click "Not interested": a ⊘ button next to every recommendation's ⋮ menu.
>
> • Your own recommended lists: Videos, Shorts and Channels collected from what YouTube offers you, ordered by what you actually open.
>
> Privacy: the statistics are kept in your browser only (you can turn them off or clear them at any time) and are never sent to the developer or anyone else. There are no accounts, analytics or ads. The source is open (Apache-2.0).
>
> ytenrich is not affiliated with, endorsed by or sponsored by YouTube or Google.

**Category:**
- Chrome: Tools.
- AMO: Photos, Music & Videos.
- Edge and Opera: Entertainment.

**Live listings** (link these from `README.md` § Install):
- Chrome: `https://chromewebstore.google.com/detail/ytenrich/ikcbajmfmiobffnnimnhojlbpieegijc` (item `ikcbajmfmiobffnnimnhojlbpieegijc`).
- Edge: `https://microsoftedge.microsoft.com/addons/detail/ytenrich/hnlgfllmbcccenikhnmbfakopidlmkfc`.
- Firefox: `https://addons.mozilla.org/firefox/addon/ytenrich/` (no locale in the path, so AMO redirects to the visitor's language).

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
- **Disclosure:** stats are the extension's prominently described purpose (listing summary and description, welcome page), so they are on by default. The welcome page that opens on install states what is recorded and has **Turn stats off**; Settings has the same switch (`src/views/consent.ts`). Keep the listing's first lines about the statistics, since that is what makes default-on acceptable under the store's disclosure rule.
- **Privacy practices answers to keep true:** images (thumbnails, avatars) are loaded from YouTube's image servers by default in the Chromium build; nothing goes to the developer.

## Firefox (addons.mozilla.org)
- `data_collection_permissions: { required: ['none'] }`. Mozilla's data collection means data transmitted outside the add-on or the local browser:
  - stats stay local;
  - "Not interested" only clicks YouTube's own menu, on the user's click;
  - the collector only keeps the page's own list loading (a CSS position on YouTube's loader element), so those requests are YouTube's, made by its page in the user's session;
  - remote thumbnails, the only request carrying user-derived data, are compiled out of the Firefox build (`__FIREFOX__`).
- Private browsing: `incognito: 'not_allowed'`. Mozilla forbids storing data from private sessions.
- **Reviewer notes** (paste into the submission):
  > Source: ytenrich-<v>-source.zip (git archive of the tagged commit). The submitted files are esbuild bundles of the TypeScript in src/.
  > Build: Node.js 24 and pnpm 11.1.2 (`corepack enable`), then `pnpm install --frozen-lockfile && pnpm build --firefox`. The output in dist-firefox/ matches the package.
  > No remote code and no network requests (the thumbnails are not in the Firefox build). Data stays in extension storage.
