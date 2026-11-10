// Live smoke: Chromium + unpacked dist/ on a real watch page. Prints JSON facts + screenshots in tmp/.
// Not a canonical gate (network/YouTube dependent). Usage: node scripts/smoke.ts [videoId]
import * as L from '../src/wm/layout.ts';
import { watchPreset } from '../src/wm/presets.ts';
import { launch } from './smoke-lib.ts';

const video = process.argv[2] ?? 'dQw4w9WgXcQ';
const { ctx, page, sw, errors } = await launch({ statsEnabled: true });
// This smoke exercises YouTube's own list, so it runs with the Videos view where the default has Recommended.
await sw.evaluate((layout) => chrome.storage.local.set(layout), {
  'layout:watch': L.replaceView(watchPreset(), 'recommended', 'videos'),
  introduced: ['recommended', 'playlist'],
});

await page.goto(`https://www.youtube.com/watch?v=${video}`, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(8000);
const facts = await page.evaluate(() => {
  const shadow = document.querySelector('ytenrich-root')?.shadowRoot;
  const rect = (el: Element | null | undefined) => {
    const r = el?.getBoundingClientRect();
    return r ? [r.left, r.top, r.width, r.height].map(Math.round).join(',') : null;
  };
  const slots = [...document.querySelectorAll('[ytenrich-slot]')].map((el) => ({
    view: el.getAttribute('ytenrich-slot'),
    inactive: el.hasAttribute('ytenrich-slot-inactive'),
    slot: rect(el),
    body: rect(shadow?.querySelector(`.body[data-view="${el.getAttribute('ytenrich-slot')}"]`)),
  }));
  return {
    wm: document.documentElement.hasAttribute('ytenrich-wm'),
    panes: shadow?.querySelectorAll('.pane').length ?? 0,
    slots,
    video: rect(document.querySelector('#movie_player video')),
    items: document.querySelectorAll('[ytenrich-dismiss]').length,
    docScroll: document.scrollingElement?.scrollHeight,
  };
});
await page.screenshot({ path: 'tmp/smoke-watch.png' });
for (const tab of ['Comments', 'Stats']) {
  await page.locator(`ytenrich-root .tab:has-text("${tab}")`).first().click();
  await page.waitForTimeout(1200);
  await page.screenshot({ path: `tmp/smoke-${tab.toLowerCase()}.png` });
}
const box = async (sel: string) => (await page.locator(sel).first().boundingBox())!;
const playerRect = () =>
  page.evaluate(
    () => document.querySelector('[ytenrich-slot=player]')?.getBoundingClientRect().width ?? 0,
  );
const videoW = () =>
  page.evaluate(
    () => document.querySelector('#movie_player video')?.getBoundingClientRect().width ?? 0,
  );
// Resize: drag the vertical handle between left column and right pane 200px left.
const handle = await box('ytenrich-root .split.row > .handle');
await page.mouse.move(handle.x + 2, handle.y + 300);
await page.mouse.down();
await page.mouse.move(handle.x - 200, handle.y + 300, { steps: 5 });
await page.mouse.up();
await page.waitForTimeout(800);
const afterResize = { player: await playerRect(), video: await videoW() };
// Drag the Stats tab onto the bottom edge of the player pane -> new pane.
const stats = await box('ytenrich-root .tab:has-text("Stats")');
const player = await box('ytenrich-root .body[data-view=player]');
await page.mouse.move(stats.x + 10, stats.y + 8);
await page.mouse.down();
await page.mouse.move(player.x + player.width / 2, player.y + player.height - 10, { steps: 8 });
await page.mouse.up();
await page.waitForTimeout(800);
const panesAfterDrag = await page.evaluate(
  () => document.querySelector('ytenrich-root')?.shadowRoot?.querySelectorAll('.pane').length,
);
await page.screenshot({ path: 'tmp/smoke-drag.png' });
// Dismiss button must not navigate.
const urlBefore = page.url();
await page.locator('ytenrich-root .tab:has-text("Videos")').first().click();
const lockup = page
  .locator('[ytenrich-slot=videos] yt-lockup-view-model:has([ytenrich-dismiss])')
  .nth(1);
await lockup.hover();
await lockup.locator('[ytenrich-dismiss]').click();
await page.waitForTimeout(2000);
const dismissStayed = page.url() === urlBefore;
// Stats (now in its own pane after the drag) must refresh itself as new impressions arrive.
const impressions = () =>
  page.evaluate(() =>
    Number(
      document.querySelector('ytenrich-root')?.shadowRoot?.querySelectorAll('.tile b')[2]
        ?.textContent ?? -1,
    ),
  );
const impBefore = await impressions();
// SPA navigation via a related video.
await page
  .locator('[ytenrich-slot=videos] yt-lockup-view-model a[href^="/watch"] >> nth=2')
  .click();
await page.waitForTimeout(6000);
const afterNav = await page.evaluate(() => ({
  url: location.pathname + location.search.slice(0, 16),
  wm: document.documentElement.hasAttribute('ytenrich-wm'),
  playerTagged: Boolean(document.querySelector('[ytenrich-slot=player]')),
}));
await page.screenshot({ path: 'tmp/smoke-nav.png' });
const statsLive = { before: impBefore, after: await impressions() };
// Hamburger toggles a Guide tile on the far left (no overlay drawer while tiling).
await page.click('ytd-masthead #guide-button');
await page.waitForTimeout(2500);
const guide = await page.evaluate(() => {
  const sh = document.querySelector('ytenrich-root')?.shadowRoot;
  const r = (e: Element | null | undefined) => {
    const b = e?.getBoundingClientRect();
    return b ? [b.left, b.top, b.width, b.height].map(Math.round).join(',') : null;
  };
  return {
    slot: r(document.querySelector('[ytenrich-slot=guide]')),
    body: r(sh?.querySelector('.body[data-view=guide]')),
    entries: document.querySelectorAll('[ytenrich-slot=guide] ytd-guide-entry-renderer').length,
    drawerOpened: document.querySelector('tp-yt-app-drawer#guide')?.hasAttribute('opened'),
  };
});
await page.screenshot({ path: 'tmp/smoke-guide.png' });
await page.click('ytd-masthead #guide-button');
await page.waitForTimeout(600);
// Reorder: drop the Log tab onto the left half of the Videos tab.
const strip = () =>
  page.evaluate(() =>
    [...(document.querySelector('ytenrich-root')?.shadowRoot?.querySelectorAll('.tab') ?? [])]
      .map((t) => (t as HTMLElement).dataset.view)
      .join('|'),
  );
const logTab = await box('ytenrich-root .tab[data-view=log]');
const vidTab = await box('ytenrich-root .tab[data-view=videos]');
await page.mouse.move(logTab.x + 10, logTab.y + 8);
await page.mouse.down();
await page.mouse.move(vidTab.x + 4, vidTab.y + 8, { steps: 8 });
await page.mouse.up();
await page.waitForTimeout(500);
const reordered = await strip();
// Settings > Reset tiling layout restores the preset (3 panes) through storage.
await page.locator('ytenrich-root .tab[data-view=settings]').click();
await page.locator('ytenrich-root button:has-text("Reset tiling layout")').click();
await page.waitForTimeout(1000);
const panesAfterReset = await page.evaluate(
  () => document.querySelector('ytenrich-root')?.shadowRoot?.querySelectorAll('.pane').length,
);
await page.keyboard.press('Alt+KeyW');
await page.waitForTimeout(800);
const offState = await page.evaluate(() => ({
  wm: document.documentElement.hasAttribute('ytenrich-wm'),
  slots: document.querySelectorAll('[ytenrich-slot]').length,
  host: Boolean(document.querySelector('ytenrich-root')),
}));
await page.screenshot({ path: 'tmp/smoke-off.png' });
const extra = {
  guide,
  reordered,
  panesAfterReset,
  statsLive,
  afterResize,
  panesAfterDrag,
  dismissStayed,
  afterNav,
  offState,
};
const dbCount = await sw.evaluate(
  () =>
    new Promise<number>((res) => {
      const r = indexedDB.open('ytenrich');
      r.onsuccess = () => {
        const c = r.result.transaction('videos').objectStore('videos').count();
        c.onsuccess = () => res(c.result);
      };
    }),
);
console.log(JSON.stringify({ ...facts, ...extra, dbCount, errors }, null, 1));
await ctx.close();
