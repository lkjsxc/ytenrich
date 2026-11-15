// Live smoke for YouTube Music: one layout for every page, the player's tiles while something is loaded.
// Signed out. Prints JSON facts and writes tmp/smoke-music-*.png.
import { dismissPromo, launch, rect, tabs } from './smoke-lib.ts';

const { ctx, page, sw, errors } = await launch({}, { desktopUa: true });
const PAGE = '[ytenrich-slot=page]';
const same = async (slot: string, view: string) =>
  (await rect(page, `[ytenrich-slot=${slot}]`)) ===
  (await rect(page, `shadow:.body[data-view=${view}]`));
const state = () =>
  page.evaluate(() => ({
    url: location.pathname,
    ui: document.querySelector('ytmusic-app-layout')?.getAttribute('player-ui-state'),
  }));
const facts = async () => ({
  ...(await state()),
  tabs: await tabs(page),
  page: await same('page', 'page'),
  guide: await same('guide', 'guide'),
  pageRect: await rect(page, PAGE),
  // Outermost parts of the page that reach past the tile's right edge (the tile clips them: it never scrolls sideways).
  wide: await page.evaluate((s) => {
    const tile = document.querySelector(s);
    if (!tile || tile.scrollWidth <= tile.clientWidth) return [];
    const edge = tile.getBoundingClientRect().right + 1;
    const out: string[] = [];
    const walk = (el: Element): void => {
      for (const c of el.children) {
        const b = c.getBoundingClientRect();
        if (!b.width || !b.height || getComputedStyle(c).position === 'absolute') continue;
        if (b.right <= edge) walk(c);
        else if (out.length < 4)
          out.push(
            `${c.tagName.toLowerCase()}#${c.id} ${Math.round(b.left)}+${Math.round(b.width)}`,
          );
      }
    };
    walk(tile);
    return out;
  }, PAGE),
});
const shelves = () =>
  page.evaluate(
    () => document.querySelectorAll('ytmusic-section-list-renderer > #contents > *').length,
  );

await page.goto('https://music.youtube.com/', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(8000);
const home = await facts();
await page.screenshot({ path: 'tmp/smoke-music-home.png' });
const before = await shelves();
for (let i = 0; i < 2; i++) {
  await page.evaluate((s) => document.querySelector(s)?.scrollTo(0, 1e6), PAGE);
  await page.waitForTimeout(3000);
}
const infinite = { before, after: await shelves() };
await page.evaluate((s) => document.querySelector(s)?.scrollTo(0, 300), PAGE);
// ☰ closes the Guide tile and brings it back.
await page.click('ytmusic-nav-bar #guide-button');
await page.waitForTimeout(600);
const guideClosed = await tabs(page);
await page.click('ytmusic-nav-bar #guide-button');
await page.waitForTimeout(1000);
const guideBack = await tabs(page);
// Playing something brings the player's tiles and the player bar; the page keeps its place.
await page.locator(`${PAGE} a[href*="watch?v="]`).first().click();
await page.waitForTimeout(9000);
const playing = {
  ...(await facts()),
  player: await same('player', 'music-player'),
  queue: await same('queue', 'queue'),
  playerRect: await rect(page, '[ytenrich-slot=player]'),
  scrollKept: await page.evaluate((s) => (document.querySelector(s)?.scrollTop ?? 0) > 0, PAGE),
  // The page tile takes clicks although the app calls its content hidden behind the player page.
  pageHit: await page.evaluate((s) => {
    const b = document.querySelector(s)?.getBoundingClientRect();
    const hit = b && document.elementFromPoint(b.left + b.width / 2, b.top + b.height / 2);
    return Boolean(hit?.closest(s));
  }, PAGE),
};
await page.screenshot({ path: 'tmp/smoke-music-playing.png' });
// Moving on in the app closes its player page; the tiles stay.
await dismissPromo(page);
await page.locator('[ytenrich-slot=guide] ytmusic-guide-entry-renderer').nth(1).click(); // Explore
await page.waitForTimeout(5000);
const explore = {
  ...(await facts()),
  player: await same('player', 'music-player'),
  queue: await same('queue', 'queue'),
  scrollTop: await page.evaluate((s) => document.querySelector(s)?.scrollTop, PAGE),
};
await page.screenshot({ path: 'tmp/smoke-music-explore.png' });
// Workspace 2: Lyrics at full height beside the player and Up next, the page too. Workspace 3: the player large.
await page.keyboard.press('Alt+Shift+Digit2');
await page.waitForTimeout(3500);
const side = () =>
  page.evaluate(() => {
    const el = document.querySelector('[ytenrich-slot=side]');
    const on = [...document.querySelectorAll('ytmusic-player-page #side-panel tp-yt-paper-tab')];
    return {
      part: el?.getAttribute('ytenrich-part'),
      appTab: on.findIndex((t) => t.classList.contains('iron-selected')),
      none: el?.hasAttribute('ytenrich-none'), // the track has no lyrics: the tile says so
      filled: (el?.querySelector('ytmusic-section-list-renderer')?.scrollHeight ?? 0) > 100,
    };
  });
const lyrics = {
  tabs: await tabs(page),
  queue: await same('queue', 'queue'),
  lyrics: await same('side', 'lyrics'),
  page: await same('page', 'page'),
  ...(await side()),
};
await page.screenshot({ path: 'tmp/smoke-music-lyrics.png' });
await page.keyboard.press('Alt+Shift+Digit3');
await page.waitForTimeout(1500);
const wide = { tabs: await tabs(page), player: await same('player', 'music-player') };
// A search there (the page is behind Up next) brings the Page tab to the front.
await dismissPromo(page);
await page.locator('ytmusic-search-box input').fill('lofi hip hop');
await page.keyboard.press('Enter');
await page.waitForTimeout(5000);
const pageFront = await same('page', 'page');
await page.screenshot({ path: 'tmp/smoke-music-wide.png' });
await page.keyboard.press('Alt+Shift+Digit1');
// Search (a page of its own element): the switcher keeps clear of the search box. A song plays as a cover.
await page.waitForTimeout(1500);
const span = async (sel: string): Promise<[number, number]> => {
  const [left = 0, , width = 0] = (await rect(page, sel))?.split(',').map(Number) ?? [];
  return [left, left + width];
};
const [boxL, boxR] = await span('ytmusic-search-box');
const [barL, barR] = await span('ytenrich-spaces');
const search = { ...(await facts()), switcherClear: barL >= boxR || barR <= boxL };
await dismissPromo(page);
await page
  .locator(
    `${PAGE} ytmusic-responsive-list-item-renderer:has-text("Song •") ytmusic-play-button-renderer >> visible=true`,
  )
  .first()
  .click();
await page.waitForTimeout(8000);
const song = {
  ...(await state()),
  tabs: await tabs(page),
  player: await rect(page, '[ytenrich-slot=player] ytmusic-player'),
  cover: await rect(page, '[ytenrich-slot=player] #song-image img'),
};
// Related is a tab behind Up next: it selects the app's own (last) tab, and the queue tile gives way.
await page.locator('ytenrich-root .tab[data-view=related]').click();
await page.waitForTimeout(3000);
const related = { ...(await side()), shown: await same('side', 'related') };
await page.screenshot({ path: 'tmp/smoke-music-song.png' });
// A detail page, opened while it plays: the page changes, the player's tiles stay.
await dismissPromo(page);
await page.locator(`${PAGE} a[href^="browse/"] >> visible=true`).first().click();
await page.waitForTimeout(6000);
const detail = {
  ...(await facts()),
  player: await same('player', 'music-player'),
  // The Related tile keeps its list although the app's player page is closed now.
  side: await side(),
};
await page.screenshot({ path: 'tmp/smoke-music-detail.png' });
// Tiling off gives the app back untouched.
await sw.evaluate(() => chrome.storage.local.set({ settings: { wmEnabled: false } }));
await page.waitForTimeout(1500);
const off = await page.evaluate(() => ({
  attr: document.documentElement.hasAttribute('ytenrich-wm'),
  slots: document.querySelectorAll('[ytenrich-slot]').length,
  host: Boolean(document.querySelector('ytenrich-root')),
  inline: document.querySelector<HTMLElement>('ytmusic-app-layout > #content')?.style.cssText,
}));
await page.screenshot({ path: 'tmp/smoke-music-off.png' });
console.log(
  JSON.stringify(
    {
      home,
      infinite,
      guideClosed,
      guideBack,
      playing,
      explore,
      lyrics,
      wide,
      pageFront,
      search,
      song,
      related,
      detail,
      off,
      errors,
    },
    null,
    1,
  ),
);
await ctx.close();
