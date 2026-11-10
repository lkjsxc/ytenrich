# ytenrich privacy policy

Last updated: November 10, 2026

ytenrich is a browser extension for `www.youtube.com`. It runs entirely in your browser. It has no developer-operated server, account, analytics, telemetry or advertising, and it never sends data to the developer.

## What ytenrich stores, and why

**Stats** are off until you agree to them ("Enable stats"). After installation, ytenrich opens a welcome page that explains the record and asks whether to enable it. You can also turn it on later from the Stats view or **Settings**, and turn it off again in **Settings**. While it is on, ytenrich keeps a local record of:
- each video or Short that YouTube shows you as a recommendation and that is at least half visible: its video ID, type (video or Short), title, channel name, the kind of page it appeared on (home, watch, search, channel, subscriptions, Shorts or other), how many times it was shown, and when it was first and last shown;
- how many times you opened each video and when you last opened it, which amounts to a list of the videos you watched (shown in the History view);
- when you used ytenrich's **Not interested** button on a video;
- videos you exempted from hiding;
- daily totals: recommendations shown (also by page kind, by hour of day, and how many were new, repeats or Shorts), videos opened, videos dismissed, and recommendations hidden by ytenrich;
- per-channel totals, keyed by channel name: recommendations shown, distinct videos, opens and dismissals.

ytenrich uses this record only to show your statistics and to hide or dim recommendations that keep reappearing without being opened. It does not record search queries, comments, or your YouTube account details.

ytenrich also stores your **settings** and **pane layouts**.

Everything is stored in your browser profile, in the extension's local storage and database. Browser sync is not used. ytenrich does not run in private windows, so nothing is recorded there.

## Retention and deletion

- A recorded video that you never opened, dismissed or exempted is deleted 90 days after it was last shown.
- The record holds at most 100,000 videos. Beyond that, the least recently shown videos are deleted first.
- Other entries and the daily totals stay until you delete them.
- **Settings → Clear statistics** deletes the whole record, including exemptions.
- Turning stats off stops new recording. It does not delete what is already stored.
- Uninstalling the extension deletes all of its stored data.

## Network requests

ytenrich makes no network requests of its own except optional images:
- **Images (Chrome and other Chromium browsers only; off by default).** If you turn on images in **Settings**, the Stats, History and Recommended views load thumbnails from YouTube's image server (`i.ytimg.com`) over HTTPS. Each request contains a video ID. Requests are sent without cookies and without a referrer. The image server receives ordinary connection information, such as your IP address. The Firefox version does not include this option.

## Actions on YouTube

- **Not interested.** When you click ytenrich's **Not interested** button on a video, ytenrich selects that same option in YouTube's own menu for that video. YouTube receives this feedback as part of your YouTube session, exactly as if you had chosen it yourself. ytenrich never does this without your click.
- **Opening videos.** Opening a video from the Stats, History or Recommended view uses YouTube's normal navigation.

Your use of YouTube is subject to [Google's privacy policy](https://policies.google.com/privacy).

## Sharing and limited use

ytenrich does not sell, transfer or share your data with anyone. It does not use your data for advertising, credit decisions or any purpose other than the features described above. No person reads your data. ytenrich's use of the information it handles adheres to the [Chrome Web Store User Data Policy](https://developer.chrome.com/docs/webstore/program-policies), including the Limited Use requirements.

## Changes

Changes to this policy are published in this file, and its history is kept in the project repository. If a change affects what data ytenrich handles, the extension will also tell you about it before the change takes effect.

## Contact

For questions or support, use the [ytenrich issue tracker](https://github.com/lkjsxc/ytenrich/issues).

ytenrich is not affiliated with, endorsed by or sponsored by YouTube or Google.
