# ytenrich privacy policy

Last updated: November 11, 2026

ytenrich is a browser extension for `www.youtube.com`. It runs entirely in your browser. It has no developer-operated server, account, analytics, telemetry or advertising, and it never sends data to the developer.

## What ytenrich stores, and why

**Stats** are off until you agree to them ("Enable stats"). After installation, ytenrich opens a welcome page that explains the record and asks whether to enable it. You can also turn it on later from the Stats view or **Settings**, and turn it off again in **Settings**. While it is on, ytenrich keeps a local record of:
- each video or Short that YouTube shows you as a recommendation and that is at least half visible: its video ID, type (video or Short), title, channel name, the kind of page it appeared on (home, watch, search, channel, subscriptions, Shorts or other), how many times it was shown, and when it was first and last shown;
- each video or Short that YouTube places on a page as a recommendation without it reaching your screen (further down a list, or in a list that your layout hides): the same details, with a shown count of zero, plus how many page views offered it and the kind of page that last did. These fill the Recommended view. This happens only after you enabled stats with it described, or agreed to it in the Recommended view; **Settings → Collect for Recommended** limits the record to what was on screen (`shown`);
- how many times you opened each video and when you last opened it, which amounts to a list of the videos you watched (shown in the History view);
- when you used ytenrich's **Not interested** button on a video;
- daily totals: recommendations shown (also by page kind, by hour of day, and how many were new, repeats or Shorts), videos opened, videos dismissed, and recommendations hidden by ytenrich;
- per-channel totals, keyed by channel name: recommendations shown, distinct videos, opens and dismissals, and the address of the channel's avatar image when a recommendation showed one.

ytenrich uses this record only to show your statistics, to build and order the Recommended view (from the channels and title words of what you open, pass over or dismiss), and, if you turn that on, to hide or dim recommendations that keep reappearing without being opened. It does not record search queries, comments, or your YouTube account details.

ytenrich also stores your **settings**, **pane layouts** and each tab's small display choices (for example, whether a Recommended tab lists videos or Shorts).

Everything is stored in your browser profile, in the extension's local storage and database. Browser sync is not used. ytenrich does not run in private windows, so nothing is recorded there.

## Retention and deletion

- A recorded video that you never opened or dismissed is deleted 90 days after it was last shown.
- The record holds at most 100,000 videos. Beyond that, the least recently shown videos are deleted first.
- Other entries and the daily totals stay until you delete them.
- **Settings → Clear statistics** deletes the whole record.
- **Settings → Export data** saves your settings, layouts and the whole record as one JSON file on your device. ytenrich sends it nowhere; the file contains your viewing record, so keep it as private as the record itself. **Import data** replaces everything in this browser with such a file.
- Turning stats off stops new recording. It does not delete what is already stored.
- Uninstalling the extension deletes all of its stored data.

## Network requests

ytenrich makes no network requests of its own except optional images:
- **Images (Chrome and other Chromium browsers only; off by default).** If you turn on images in **Settings**, the Stats, History and Recommended views load thumbnails from YouTube's image server (`i.ytimg.com`) and channel avatars from its avatar server (`yt3.ggpht.com` or `yt3.googleusercontent.com`) over HTTPS. A thumbnail request contains a video ID; an avatar request contains the avatar's address. Requests are sent without cookies and without a referrer. The image server receives ordinary connection information, such as your IP address. The Firefox version does not include this option.

## Actions on YouTube

- **Not interested.** When you click ytenrich's **Not interested** button on a video, ytenrich selects that same option in YouTube's own menu for that video. YouTube receives this feedback as part of your YouTube session, exactly as if you had chosen it yourself. ytenrich never does this without your click.
- **Loading more recommendations (`more` in Settings → Collect for Recommended; chosen when you enable stats, and offered as a question in the Recommended view if you enabled stats before this existed).** On a watch page, the home page or another feed page whose YouTube list your layout does not show, ytenrich lets YouTube load further pages of that list, as scrolling it would, until about 300 recommendations are on the page (about 80 once ytenrich already holds 1,500 unopened recommendations from the last three days). These are YouTube's own requests in your YouTube session; ytenrich sends nothing itself. Choose `page` or `shown` to turn this off.
- **Opening videos.** Opening a video from the Stats, History or Recommended view uses YouTube's normal navigation.

Your use of YouTube is subject to [Google's privacy policy](https://policies.google.com/privacy).

## Sharing and limited use

ytenrich does not sell, transfer or share your data with anyone. It does not use your data for advertising, credit decisions or any purpose other than the features described above. No person reads your data. ytenrich's use of the information it handles adheres to the [Chrome Web Store User Data Policy](https://developer.chrome.com/docs/webstore/program-policies), including the Limited Use requirements.

## Changes

Changes to this policy are published in this file, and its history is kept in the project repository. If a change affects what data ytenrich handles, the extension will also tell you about it before the change takes effect.

## Contact

For questions or support, use the [ytenrich issue tracker](https://github.com/lkjsxc/ytenrich/issues).

ytenrich is not affiliated with, endorsed by or sponsored by YouTube or Google.
