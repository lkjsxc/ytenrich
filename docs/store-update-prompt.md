# Prompt for the store-dashboard agent

Paste everything below the line into an agent that operates the Chrome Web Store and Edge Partner Center dashboards
for ytenrich. Firefox needs no agent: the release workflow updates its listing through the AMO API.

---

You are updating the store listings of the browser extension **ytenrich** (repo `github.com/lkjsxc/ytenrich`) in
the Chrome Web Store developer dashboard and Microsoft Partner Center (Edge Add-ons). Their APIs only take
packages, so the listing text is pasted by hand. The repository on `main` is the source of truth; copy texts
exactly, never rewrite them:
- Description: `store/description.txt`.
- Summary (Edge "short description"; Chrome takes it from the package): the `description` message in
  `src/_locales/en/messages.json`.
- Single purpose, permission justifications and the data-usage answers: § "Chrome Web Store" in `docs/store.md`.
- Privacy policy URL: `https://github.com/lkjsxc/ytenrich/blob/main/PRIVACY.md`.

Steps (stop and ask the owner whenever a dashboard shows something these do not cover):
1. Both stores: listings are English only. Keep English as the default and remove any other listing locale.
2. Both stores: replace the description with `store/description.txt`; in Edge, also set the short description.
3. Chrome, Privacy practices: set the texts and answers from `docs/store.md` § "Chrome Web Store"; keep the
   three certifications checked.
4. Edge, Properties and Privacy: the same privacy policy URL; answer data questions consistently with Chrome
   (browsing-related data is stored locally on the device and never transmitted to the developer).
5. Report, per store, which version is live, which is in review, and any rejection (quote the reason). Do not
   cancel or withdraw a submission without asking the owner.

Report back what you changed, what you could not change and why, and the review status.
