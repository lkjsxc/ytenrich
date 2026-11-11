# Prompt for the store-dashboard agent (ChatGPT)

Paste everything below the line into the agent that operates the store dashboards for ytenrich.

---

You are updating the store listings of the browser extension **ytenrich** (repo `github.com/lkjsxc/ytenrich`) to
match version 0.2.6. Work in the three dashboards: Chrome Web Store developer dashboard, Microsoft Partner
Center (Edge Add-ons) and addons.mozilla.org (Firefox). The source of truth for every text is
`docs/store.md` and `PRIVACY.md` on the `main` branch; read both first and copy texts from them exactly.

Why this is needed: since 0.2.6 the local statistics are **on by default** (before, the user had to enable
them), thumbnails are loaded from YouTube's image servers by default in the Chromium build, and the extension
has new features (its own recommended Videos / Shorts / Channels lists). The listings must describe the
statistics prominently, because that is what makes default-on acceptable under the stores' disclosure rules.

Do these steps, and stop to ask the owner whenever a dashboard shows something these steps do not cover.

1. **Descriptions (all three stores).** Replace the English description with "Description (en)" from
   `docs/store.md`, and the Japanese one with "Description (ja)". Keep the summary line as in `docs/store.md`.
2. **Chrome: Privacy practices tab.**
   - Single purpose and permission justifications: use the texts under "Chrome Web Store" in `docs/store.md`.
   - Data usage: keep "Web history", "Website content" and "User activity" checked; keep all three
     certifications checked. Nothing is sold or transferred.
   - Privacy policy URL: `https://github.com/lkjsxc/ytenrich/blob/main/PRIVACY.md`.
3. **Edge: Properties and Privacy.** Same privacy policy URL. If asked whether the extension collects personal
   information, answer consistently with Chrome: browsing-related data is stored locally on the device and is
   never transmitted to the developer.
4. **Firefox.** No change to the data-collection declaration: the Firefox build transmits nothing (it has no
   image loading), and local storage is not "data collection" in Mozilla's sense. Only update the descriptions.
5. **Reviewer notes** (wherever a dashboard has a notes-for-reviewer field): "Local statistics are on by
   default and described on the welcome page that opens after installation, which also has a Turn stats off
   button. All data stays in the browser. On Chromium, thumbnails are loaded from i.ytimg.com and yt3.ggpht.com."
6. **Pending submissions.** For each store, report which version is live, which is in review, and whether a
   review was rejected (quote the reason). Do not cancel or withdraw anything without asking the owner.
7. When a store has no submission in review, tell the owner so the newest version can be submitted from GitHub
   Actions ("Re-run failed jobs" on the newest "Browser stores" run for the newest tag).

Report back: per store, what you changed, what you could not change and why, and the review status.
