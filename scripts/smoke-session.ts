// Real YouTube + extension: continuous playback through SPA browsing, history and replacement, in one browser.
import assert from 'node:assert/strict';
import { rect } from './smoke-lib.ts';
import { openOwnHistory } from './smoke-session-history.ts';
import { launchSession } from './smoke-session-launch.ts';
import { assertStopped, createSessionProof, openTotals, readyVideo } from './smoke-session-lib.ts';
import {
  finishNavigation,
  installNavigationProof,
  startNavigation,
} from './smoke-session-navigation.ts';

const original = process.argv[2] ?? 'dQw4w9WgXcQ';
assert.match(original, /^[\w-]{6,}$/);
const { ctx, page, sw, errors } = await launchSession({
  statsEnabled: true,
  introDone: true,
  closeClicks: 1,
});
const facts: unknown[] = []; // bound: the fixed sequence of at most 24 navigations below
let stage = 'starting';
try {
  await ctx.addCookies([
    { name: 'PREF', value: 'hl=en&gl=US&f6=400', domain: '.youtube.com', path: '/' },
  ]);
  await installNavigationProof(page);
  await page.goto(`https://www.youtube.com/watch?v=${original}`, { waitUntil: 'domcontentloaded' });
  let proof = await createSessionProof(page);
  const origin = await page.evaluate(() => performance.timeOrigin);
  const start = await openTotals(sw, original);
  assert.deepEqual(start, { opened: 1, events: 1 }, 'A new document records one original open');
  const shot = async (size: string, name: string): Promise<void> => {
    await page
      .getByText('No thanks', { exact: true })
      .first()
      .click({ timeout: 500 })
      .catch(() => undefined);
    await page.mouse.move(0, 0);
    await page.screenshot({ path: `tmp/smoke-session-${size}-${name}.png` });
  };
  const hop = async (
    name: string,
    act: () => Promise<unknown>,
    route: (url: URL) => boolean,
    pageTile = true,
  ): Promise<void> => {
    stage = name;
    await startNavigation(page);
    await act();
    await page.waitForURL(route);
    await finishNavigation(page);
    await page.mouse.move(0, 0);
    facts.push(await proof.check(name, pageTile));
  };
  const home = (url: URL): boolean => url.pathname === '/';
  const search = (url: URL): boolean => url.pathname === '/results';
  const channel = (url: URL): boolean => /^\/(?:@|channel\/|c\/|user\/)/.test(url.pathname);
  const watchingOriginal = (url: URL): boolean =>
    url.pathname === '/watch' && url.searchParams.get('v') === original;
  const goHome = () => page.locator('ytd-masthead a#logo').click();
  const searchFor = async (query: string): Promise<void> => {
    const input = page.locator('ytd-masthead input[name=search_query]');
    await input.fill(query);
    await input.press('Enter');
  };
  const goChannel = () =>
    page
      .locator(
        '[ytenrich-slot=page] a:is([href^="/@"], [href^="/channel/"], [href^="/c/"], [href^="/user/"]):visible',
      )
      .first()
      .click();
  const journey = async (size: string): Promise<void> => {
    await shot(size, 'watching');
    await hop(`${size}-home`, goHome, home);
    await shot(size, 'home');
    await hop(`${size}-search`, () => searchFor('lofi hip hop'), search);
    await shot(size, 'search');
    await hop(`${size}-channel`, goChannel, channel);
    await shot(size, 'channel');
  };

  await journey('1440x900');
  await hop('back-search', () => page.goBack(), search);
  await hop('forward-channel', () => page.goForward(), channel);
  await hop('back-search-again', () => page.goBack(), search);
  await hop('back-home', () => page.goBack(), home);
  await hop('back-watch', () => page.goBack(), watchingOriginal, false);
  assert.deepEqual(
    await openTotals(sw, original),
    start,
    'Returning to kept playback adds no History or Stats open',
  );
  await hop('forward-home', () => page.goForward(), home);
  await hop('forward-search', () => page.goForward(), search);
  await hop('forward-channel-again', () => page.goForward(), channel);

  stage = 'pick another video';
  const link = page
    .locator(`[ytenrich-slot=page] a[href^="/watch?v="]:not([href*="${original}"]):visible`)
    .first();
  const href = await link.getAttribute('href');
  assert(href, 'The channel contains another watch video');
  const selected = new URL(href, page.url()).searchParams.get('v');
  assert(selected && selected !== original);
  const rectangle = proof.rectangle();
  facts.push({ label: 'selection request', selected, href });
  await startNavigation(page);
  await link.click();
  await page.waitForURL(
    (url) => url.pathname === '/watch' && url.searchParams.get('v') === selected,
  );
  await finishNavigation(page);
  await page
    .locator(`ytd-watch-flexy[video-id="${selected}"]:not([hidden])`)
    .waitFor({ state: 'attached' });
  const replacement = await readyVideo(page);
  assert.equal(
    await replacement.evaluate((video) => {
      const player = video.closest('#movie_player') as Element & {
        getVideoData?: () => { video_id?: string };
      };
      return player?.getVideoData?.().video_id;
    }),
    selected,
    'The actual player has loaded the chosen content video, including during its pre-roll',
  );
  assert.equal(
    await page.evaluate(() => performance.timeOrigin),
    origin,
    'Picking a video is also SPA navigation',
  );
  assert.equal(
    await rect(page, '[ytenrich-slot=player]'),
    rectangle,
    'Replacement uses the same tile',
  );
  assert.equal(
    await replacement.evaluate(
      () =>
        [...document.querySelectorAll('video')].filter((video) => !video.paused && !video.ended)
          .length,
    ),
    1,
    'Replacement has only one playing video',
  );
  assert.deepEqual(await openTotals(sw, original), start);
  assert.deepEqual(await openTotals(sw, selected), { opened: 1, events: 1 });
  facts.push({ label: 'replacement', selected, rectangle, sameDocument: true });
  await replacement.dispose();
  await proof.dispose();

  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.waitForTimeout(400);
  proof = await createSessionProof(page);
  await journey('1920x1080');
  await page.setViewportSize({ width: 700, height: 600 });
  await proof.rebase();
  facts.push(await proof.check('700x600-channel'));
  await shot('700x600', 'channel');

  stage = 'own History video';
  await page.setViewportSize({ width: 1440, height: 900 });
  await proof.rebase();
  facts.push(await openOwnHistory(page, sw, original, origin, proof.rectangle()));

  stage = 'close player';
  await page.locator('ytenrich-root .tab[data-view=player] button.x').click();
  await assertStopped(page);
  facts.push({ label: stage, stopped: true });
  await proof.dispose();

  // A fresh scenario verifies the Settings opt-out restores the ordinary Home family and stops playback.
  stage = 'setting off';
  await page.waitForTimeout(500); // let the intentional close's existing storage debounce finish
  await sw.evaluate(async () => {
    await chrome.storage.local.remove('layout:watch');
    const stored = await chrome.storage.local.get('settings');
    await chrome.storage.local.set({
      settings: { ...(stored.settings as Record<string, unknown>), sessionPlayback: false },
    });
  });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(`https://www.youtube.com/watch?v=${original}`, { waitUntil: 'domcontentloaded' });
  const offVideo = await readyVideo(page);
  await goHome();
  await page.waitForURL(home);
  await assertStopped(page);
  await offVideo.dispose();
  facts.push({ label: stage, stopped: true });
  assert.deepEqual(errors, [], 'The extension emits no error');
  console.log(JSON.stringify({ session: facts, errors }, null, 1));
} catch (error) {
  await page.screenshot({ path: 'tmp/smoke-session-failure.png' });
  console.error(JSON.stringify({ failedAt: stage, url: page.url(), facts, errors }, null, 1));
  throw error;
} finally {
  await ctx.close();
}
