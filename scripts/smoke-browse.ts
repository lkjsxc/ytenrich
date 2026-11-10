// Live smoke for tiling on non-watch pages (search, channel) and switching layout families via SPA navigation.
import { launch, rect, tabs } from './smoke-lib.ts';

const { ctx, page, sw, errors, welcome } = await launch();
// Consent: the welcome tab opens on install; recording stays off until "Start recording".
const consent = { welcome: Boolean(welcome), before: false, after: false };
if (welcome) {
  await welcome.waitForLoadState();
  const on = () =>
    sw.evaluate(async () =>
      Boolean(
        ((await chrome.storage.local.get('settings')).settings as { statsEnabled?: boolean })
          ?.statsEnabled,
      ),
    );
  consent.before = await on();
  await welcome.screenshot({ path: 'tmp/smoke-welcome.png' });
  await welcome.locator('button:has-text("Start recording")').click();
  await welcome.waitForTimeout(500);
  consent.after = await on();
  await welcome.close();
}
const pageFacts = async () => ({
  tabs: await tabs(page),
  tag: await page.evaluate(() =>
    document.querySelector('[ytenrich-slot=page]')?.tagName.toLowerCase(),
  ),
  slot: await rect(page, '[ytenrich-slot=page]'),
  body: await rect(page, 'shadow:.body[data-view=page]'),
  guide:
    (await rect(page, '[ytenrich-slot=guide]')) ===
    (await rect(page, 'shadow:.body[data-view=guide]')),
});
const count = () =>
  page.evaluate(() => document.querySelectorAll('[ytenrich-slot=page] ytd-video-renderer').length);
const scrollPage = (to: 'end' | 0) =>
  page.evaluate((t) => {
    const s = document.querySelector('[ytenrich-slot=page]');
    s?.scrollTo(0, t === 'end' ? s.scrollHeight : 0);
    return s?.scrollTop ?? -1;
  }, to);

await page.goto('https://www.youtube.com/results?search_query=lofi+hip+hop', {
  waitUntil: 'domcontentloaded',
});
await page.waitForTimeout(7000);
const search = await pageFacts();
await page.screenshot({ path: 'tmp/smoke-browse-search.png' });
const before = await count();
for (let i = 0; i < 2; i++) await scrollPage('end'), await page.waitForTimeout(3500);
const infinite = { before, after: await count() };
// ☰ closes the Guide tile and brings it back.
await page.click('ytd-masthead #guide-button');
await page.waitForTimeout(600);
const guideClosed = await tabs(page);
await page.click('ytd-masthead #guide-button');
await page.waitForTimeout(1500);
const guideBack = await tabs(page);
// SPA to a watch page swaps to the watch layout; Back restores the browse layout at scroll 0.
await page
  .locator('[ytenrich-slot=page] ytd-video-renderer a#thumbnail[href^="/watch"]')
  .nth(1)
  .click();
await page.waitForTimeout(6000);
const watch = { tabs: await tabs(page), player: await rect(page, '[ytenrich-slot=player]') };
await page.goBack();
await page.waitForTimeout(4000);
const back = {
  ...(await pageFacts()),
  scrollTop: await page.evaluate(() => document.querySelector('[ytenrich-slot=page]')?.scrollTop),
};
await page.goto('https://www.youtube.com/@YouTube/videos', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(7000);
const channel = {
  ...(await pageFacts()),
  header: await rect(page, '[ytenrich-slot=page] tp-yt-app-header'),
};
// Home's frosted-glass band (signed in only) must not cover the tab strips: force its mode and hit-test the strip.
const frostedCovered = await page.evaluate(() => {
  const f = document.querySelector('ytd-app #frosted-glass');
  f?.classList.replace('none', 'with-chipbar');
  return document.elementFromPoint(400, 70)?.tagName.toLowerCase() !== 'ytenrich-root';
});
await page.screenshot({ path: 'tmp/smoke-browse-channel.png' });
console.log(
  JSON.stringify(
    {
      consent,
      search,
      infinite,
      guideClosed,
      guideBack,
      watch,
      back,
      channel,
      frostedCovered,
      errors,
    },
    null,
    1,
  ),
);
await ctx.close();
