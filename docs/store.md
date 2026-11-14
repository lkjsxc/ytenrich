# Store submission

Keep this file in sync with `PRIVACY.md` and the code. Re-check it whenever a feature starts storing or sending anything new. The listing text itself lives in files (§ Listing text) and reaches the stores from the release workflow as far as their APIs allow. `docs/store-update-prompt.md` is a ready prompt for an agent that does the rest in the Chrome and Edge dashboards.

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

1. Run `pnpm bump`, write the new top section of `store/release-notes.md` (`pnpm check` fails until its version matches), and land both with the release changes on `main`. Check the privacy declarations in each dashboard when data handling or permissions change; no API reaches those.
2. When ready to submit, push one matching tag at a time from the intended commit on `main`. For example, for version `0.1.1`:

   ```sh
   git tag v0.1.1
   git push origin refs/tags/v0.1.1
   ```

3. The same tag publishes a [GitHub release](https://github.com/lkjsxc/ytenrich/releases) whose text is the newest section of `store/release-notes.md`, with `ytenrich-chromium.zip`, `ytenrich-firefox.zip` (fixed names, so README's `releases/latest/download/…` links always give the newest) and the source ZIP. It does not wait for the stores.
4. When `store/description.txt` or the summary changed since the previous tag, the run's summary page (package job) shows the text to paste into the Chrome and Edge dashboards. The Firefox job has already put it on AMO.
5. Check the three submission jobs under [Actions](https://github.com/lkjsxc/ytenrich/actions/workflows/store-release.yml) and the review status in each store dashboard. Firefox submits its source ZIP alongside the extension. The jobs finish when submissions are accepted for review.
6. For a partial failure, check the affected dashboard first. If the version is still unsubmitted, correct the cause and use **Re-run failed jobs**. Chrome and Firefox check for an existing submission of the same version. For Edge, verify a timed-out upload or publish using the operation ID in the job log and the status in Partner Center before rerunning. Use the original ZIP to finish any confirmed draft in the dashboard if the store rejects a repeated upload. If a store rejects the version and the code needs a fix, release a new version.

API references: [Chrome Web Store v2](https://developer.chrome.com/docs/webstore/using-api/), [Edge Add-ons v1.1](https://learn.microsoft.com/en-us/microsoft-edge/extensions/update/api/using-addons-api), [Firefox Add-ons](https://mozilla.github.io/addons-server/topics/api/addons.html#version-create).

## Build of main
`.github/workflows/build.yml` runs on every push to `main`: `pnpm check`, `pnpm package`, then it keeps `dist/` and `dist-firefox/` as the run's artifacts `ytenrich-chromium` and `ytenrich-firefox` (downloadable from the run page by signed-in GitHub users, kept 90 days). It touches neither the stores nor GitHub releases, which hold versions only.

## Listing text

All store listings are English only. Keep English as the default and remove other listing locales, including Japanese. Package metadata lives only in `src/_locales/en/messages.json`; do not reintroduce other `_locales` directories. Store navigation may still follow the visitor's language; the extension's listing text stays English.
**Name:** ytenrich (the manifest).

The files are the source of truth; do not copy their text into this file.

| Text | File | Chrome | Edge | Firefox (AMO) |
|---|---|---|---|---|
| Summary (≤132 chars) | `src/_locales/en/messages.json` `description` | the package | paste as the short description | API, on release |
| Description (≤10,000 chars) | `store/description.txt` | paste (run summary) | paste (run summary) | API, on release |
| Release notes | `store/release-notes.md`, newest section | — | — | API, on release (also the GitHub release text) |
| Notes for reviewers | `store/reviewer-notes.txt` | — | API, with each submission | API, with each submission |
| Privacy policy | `PRIVACY.md` | URL below | URL below | API, on release (as plain text) |

`scripts/store-listing.ts` reads them (`node scripts/store-listing.ts` previews all; `tests/store-listing.test.ts` checks lengths and the release-notes version) and sends the Firefox parts (`syncFirefoxListing`: summary, description, homepage, privacy policy, version notes, in the add-on's default locale). Screenshots, categories and the Chrome/Edge privacy forms stay in the dashboards; no store API takes them except AMO's previews, which are not synced yet.

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
- **Disclosure:** stats are the extension's prominently described purpose (listing summary and description, welcome card), so they are on by default. Install opens YouTube, where the welcome card above the recommended lists states what is recorded and has **Turn stats off** until acknowledged; Settings has the same switch (`src/views/consent.ts`). Keep the first paragraph of `store/description.txt` about the record, since that is what makes default-on acceptable under the store's disclosure rule.
- **Privacy practices answers to keep true:** images (thumbnails, avatars) are loaded from YouTube's image servers by default in the Chromium build; nothing goes to the developer.

## Firefox (addons.mozilla.org)
- `data_collection_permissions: { required: ['none'] }`. Mozilla's data collection means data transmitted outside the add-on or the local browser:
  - stats stay local;
  - "Not interested" only clicks YouTube's own menu, on the user's click;
  - the collector only keeps the page's own list loading (a CSS position on YouTube's loader element), so those requests are YouTube's, made by its page in the user's session;
  - remote thumbnails, the only request carrying user-derived data, are compiled out of the Firefox build (`__FIREFOX__`).
- Private browsing: `incognito: 'not_allowed'`. Mozilla forbids storing data from private sessions.
- **Reviewer notes:** `store/reviewer-notes.txt`, sent with every submission (source ZIP and build steps included).
