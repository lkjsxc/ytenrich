# ytenrich

A browser extension that makes YouTube more personal and more comfortable to use: recommendation statistics, hiding of recommendations that keep reappearing without being opened, one-click "Not interested", and a tiling window manager layout on watch pages.

![Watch page as a tiling window manager](docs/images/watch-tiling-dark.webp)

## Features
- **Tiling watch page**: player, details, comments and recommendations sit in resizable panes, and each pane scrolls on its own.
  - Drag a tab to a pane edge to split that pane; drop it on the center to join that pane's tabs.
  - Recommendations are split into separate Videos and Shorts tabs.
  - Stats, Settings and Log open as tabs inside the panes.
  - `Alt+W` turns tiling off and on.
- **Recommendation stats**: each recommendation counts as seen once it is at least half visible, at most once per page view. Thumbnails show how many times you have seen a video.
- **Hide over-exposed videos**: videos recommended N times that you never opened are hidden or dimmed. You choose N.
- **One-click "Not interested"**: hover a thumbnail and click ✕.

Enable recommendation recording in **Settings** to build your stats and filter repeated recommendations. Images in the extension's Stats and Shorts views are a separate opt-in. See the [privacy policy](PRIVACY.md).

## Install (from source)
```sh
pnpm install && pnpm build
```
- Chromium: open `chrome://extensions`, turn on Developer mode, click "Load unpacked" and select `dist/`.
- Firefox (desktop 140+): run `pnpm build --firefox`, open `about:debugging`, choose "Load Temporary Add-on" and select `dist-firefox/manifest.json`. Grant access to youtube.com if prompted.

## Screenshots
| | |
|-|-|
| ![Watch page, dark theme](docs/images/watch-tiling-dark.webp) | Watch page tiling (dark): player, details, comments, recommendations |

## Development
AI-first repository: start at [AGENTS.md](AGENTS.md).

### Firefox reviewer build

Use Node.js 24.15.0 and pnpm 11.1.2. From the root of the source archive:

```sh
npx --yes pnpm@11.1.2 install --frozen-lockfile
npx --yes pnpm@11.1.2 build --firefox
```

The extension files are in `dist-firefox/`, with `manifest.json` at the package root.

## License
[Apache-2.0](LICENSE)
