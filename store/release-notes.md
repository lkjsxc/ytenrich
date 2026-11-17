<!-- Newest version first. The top section must match package.json (pnpm check): it becomes the GitHub release text
and the Firefox version notes. Write it for users, in a few lines. -->

## 0.2.15

- Keep watching while you browse Home, search, channels or playlists in a neighbouring tile. The Player stays where you put it, and Back and Forward move the page without restarting the video.
- The browsed Page uses an existing neighbouring pane. Your watch tabs stay available and return when you go back to the watch page. Choosing another video plays it in the same Player and brings its watch page back.
- Browsing while a video plays uses its watch workspace; your other layouts return when the Player closes. All saved layouts and all nine workspaces per page type are kept. Layouts without a neighbouring pane use ordinary navigation.
- Returning to the same playing video does not add another History or Stats open.
- Close the Player to stop playback, or turn off Settings → Layout: Keep playing while browsing. Shorts keep their existing behaviour; fullscreen stays with YouTube.

## 0.2.14

- YouTube Music has its own History and Stats: track starts and replays count after 10 seconds of playback, with title, artist, thumbnail and duration from the player. Short skips leave no record. Music Stats uses Plays, Tracks and Artists.
- Music plays stay separate from YouTube history, statistics and recommendations. Existing records keep their times and counts; unmarked older rows belong to YouTube.
- History shows every recorded open, including return visits to the same video.
- History thumbnails and titles align with or without ×N. Click ×N beside a time to see that video's recorded opens; click a time to jump to its loaded row.
- Existing history keeps each video's latest recorded time. Earlier visits whose times were never stored are counted separately.

## 0.2.13
- YouTube Music: Up next, Lyrics and Related are tiles of their own, so the queue stays in view while you read the lyrics.
- The queue follows the playing track. Lyrics are larger, start from the top on each track, and say so when a track has none.
- The cover is shown whole over a soft backdrop of itself, at any tile size.
- Workspace 1 is for browsing while listening, 2 has the lyrics at full height, 3 has the player large. Your own layouts are kept.
- Opening a search result or a guide link brings the page tile forward, and narrow windows drop the guide by default.

## 0.2.12
- YouTube Music (music.youtube.com) is tiled too: the page you browse, the player and Up next (with Lyrics and Related) sit side by side next to the guide, so you can keep browsing while a video plays. The player's panes appear when something is loaded.
- Workspace numbers on YouTube Music are at the right of its search bar; workspace 2 has the player large.
- Nothing is recorded on YouTube Music. The extension now also asks for access to music.youtube.com.

## 0.2.11
- Recommended lists have a search box over titles and channel names, and their settings sit behind a larger ▶ button on the left: one kind per list (Videos, Shorts or Mix lists), all channels or only this channel.
- Cards show the view count next to the upload age.
- Lists load their next page well before you reach the end, and the order on screen stays put.
- Channel pages show the guide and the page at full width, and the channel's tab bar (Home, Videos, …) is no longer cut off in a narrow pane.
- On narrow windows, the workspace numbers give way to YouTube's search box instead of overlapping it.
