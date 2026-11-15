# YouTube Music: friction list (surveyed live 2026-11-14/15, signed out, 1440×900, 1920×1080, 700×600)

What a listener meets, most frequent first, and what was decided. Names and DOM facts are in
[youtube-dom.md](youtube-dom.md#youtube-music-musicyoutubecom-verified-live-2026-11-15-logged-out-desktop-1440px);
the mechanics in [architecture.md](architecture.md#youtube-music).

## Fixed
| Surface | Problem | Decision |
| --- | --- | --- |
| Up next tile | The app's own tab row (Up next / Lyrics / Comments / Related) sat under the tile's tab: two tab bars, and the queue vanished whenever Lyrics was read | Up next, Lyrics and Related are tabs of the layout. The queue is a tile of its own, so Lyrics shows beside it; the app's tab row is not drawn and its selection follows the tab on show |
| Up next tile | "Playing from", the autoplay switch and the mood chips touched the tile's edges; Save was cut off on the right | One 12px edge for all of them |
| Up next tile | As a tile the queue no longer followed playback (the app scrolls its own panel) | On a new track the playing row glides to one row below the top, unless the pointer is on the tile |
| Player tile | A cover stood between grey bars in any tile that is not square | The cover, whole and rounded, over a blurred, darkened enlargement of itself; a video fits the tile on black |
| Lyrics | 14px text against the left edge; with the app's player page closed the scroll position survived a track change; a track without lyrics left the last list or nothing | 15–22px growing with the tile, 1.7 line height, a centred column of at most 640px; top of the text on every new track; "No lyrics for this track." |
| Workspaces 2 and 3 | A search or a guide link changed a page that was behind another tab: nothing visible happened | A navigation to another page brings the Page tab to the front |
| Workspaces | One listening layout and one with the player large | 1 browse and listen (guide, page, player over Up next / Lyrics / Related), 2 read along (player over Up next, Lyrics at full height, page), 3 the player large with the rest as tabs |
| Reload or a link to `/watch` | The Page tile was black: the app has no page behind its player there | Home opens in the tile once, the player stays |
| Narrow window | The default gave the guide 30% of 700px; a guide tile there showed the drawer's own hamburger and logo over its first entries | Below 1100px the default has no guide (☰ adds it); that row is hidden in the tile |
| Nav bar | On search pages the workspace chips' group reached 13px under the search box; at 1440px the ninth chip was cut | The chips keep 12px clear of the box, and are 28px wide up to 1500px so all nine fit from 1430px |

## Checked and left as it is
- A track change re-renders nothing: no tile moves, the player's tiles stay (`player-visible` holds).
- A reload draws the saved layout with its first paint (no default first), also on `/watch`.
- Fullscreen (`f`) gives the app back whole and returns to the same tiles.
- The app's shortcuts (Space, `m`, `l`, `i`, `q`) work after a click on a tab or a pane: focus stays on the page.
- A video track fits its tile; an advertisement plays in the Player tile; popups, menus and toasts stay above tiles.

## Left
- Comments (the app's third tab) is not a tile. Lyrics and Related are one element of the app, so only one of
  them shows at a time; a second one says "Nothing to show here on this page."
- A layout saved on a wide window keeps its guide on a narrow one (panes scale; they do not drop out by width).
- The Premium promotion the app shows signed out covers the lower left corner until answered: the app's own. One
  of them ("Want music without the ads?", after an advertisement) was seen holding the app's whole layout `inert`
  (no click lands on the page, the queue or the search box; tabs and panes of the layout still answer) until "No
  thanks"; the attribute stayed when tiling was switched off and went when the promotion was answered. It did not
  come up in a run without tiling, so whether the app does this by itself is not confirmed.
- The player bar's ▲/▼ and the cover's "miniplayer" button only flip the app's own state while tiling.
- Not verified signed out: Library, the Song / Video switch (`#av-id`), likes, playlists of one's own, dragging
  queue rows to reorder. Not verified in Firefox.
