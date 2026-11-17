// Additional live session modes. One browser, sequential scenarios; a missing native path is a failure.
import assert from 'node:assert/strict';
import type { ElementHandle } from 'playwright';
import { pane } from '../src/wm/layout.ts';
import { rect } from './smoke-lib.ts';
import { launchSession } from './smoke-session-launch.ts';
import { assertStopped } from './smoke-session-lib.ts';
import {
  disableThroughSettings,
  fullscreenRoundTrip,
  functionalSearch,
  noTwoSounds,
  patchSettings,
} from './smoke-session-mode-controls.ts';
import { chooseLive, createModeProof, progress } from './smoke-session-modes-lib.ts';
import {
  finishNavigation,
  installNavigationProof,
  nativeFilter,
  nativeHome,
  nativeSearch,
  startNavigation,
} from './smoke-session-navigation.ts';

const original = process.argv[2] ?? 'dQw4w9WgXcQ';
assert.match(original, /^[\w-]{6,}$/);
const { ctx, page, sw, errors } = await launchSession({
  statsEnabled: false,
  introDone: true,
  shortsAsVideos: false,
  closeClicks: 1,
});
const facts: unknown[] = []; // bound: the fixed sequence of modes below
let stage = 'start';
try {
  await ctx.addCookies([
    { name: 'PREF', value: 'hl=en&gl=US&f6=400', domain: '.youtube.com', path: '/' },
  ]);
  await installNavigationProof(page);
  const fresh = async () => {
    await patchSettings(sw, { sessionPlayback: true, shortsAsVideos: false });
    await sw.evaluate(() => chrome.storage.local.set({ 'layout:watch:spaces': { active: 1 } }));
    await page.goto(`https://www.youtube.com/watch?v=${original}`, {
      waitUntil: 'domcontentloaded',
    });
    return createModeProof(page);
  };
  let proof = await fresh();
  stage = 'theatre';
  await page.locator('#movie_player .ytp-size-button').first().click();
  await page.waitForFunction(() =>
    document.querySelector('ytd-watch-flexy')?.hasAttribute('theater'),
  );
  facts.push(await proof.check(stage));

  stage = 'fullscreen';
  facts.push(...(await fullscreenRoundTrip(page, proof, stage)));

  stage = 'playlist';
  await nativeHome(page);
  facts.push(await proof.check('theatre to Home'));
  await nativeSearch(page, 'lofi playlist');
  facts.push(await proof.check('playlist search'));
  await nativeFilter(page, 'Playlists');
  facts.push(await proof.check('playlist filter'));
  const playlist = page.locator('[ytenrich-slot=page] a[href^="/playlist?list="]:visible').first();
  await playlist.waitFor();
  const playlistHref = await playlist.getAttribute('href');
  assert(playlistHref, 'Search exposes a native playlist-page link');
  const list = new URL(playlistHref, page.url()).searchParams.get('list');
  await startNavigation(page);
  await playlist.click();
  await page.waitForURL(
    (url) => url.pathname === '/playlist' && url.searchParams.get('list') === list,
  );
  await finishNavigation(page);
  await page.locator('ytd-browse[page-subtype=playlist][ytenrich-slot=page]').waitFor();
  assert.equal(
    await rect(page, '[ytenrich-slot=page]'),
    await rect(page, 'shadow:.body[data-view=page]'),
  );
  facts.push(await proof.check('playlist beside video'));
  await page.screenshot({ path: 'tmp/smoke-session-playlist.png' });

  stage = 'live result';
  await nativeSearch(page, 'lofi girl live');
  facts.push(await proof.check('live search'));
  const liveId = await chooseLive(page);
  await proof.dispose();
  proof = await createModeProof(page);
  facts.push({ label: 'verified live stream', id: liveId });
  stage = 'live fullscreen';
  facts.push(...(await fullscreenRoundTrip(page, proof, 'live-fullscreen')));
  await nativeHome(page);
  facts.push(await proof.check('live beside Home'));
  stage = 'retained fullscreen';
  facts.push(...(await fullscreenRoundTrip(page, proof, 'retained-fullscreen', true)));
  stage = 'live beside search';
  await nativeSearch(page, 'lofi music');
  facts.push(await proof.check('live beside search'));
  await page.screenshot({ path: 'tmp/smoke-session-live.png' });

  stage = 'workspace without Player';
  await sw.evaluate(
    (layout) => chrome.storage.local.set({ 'layout:watch:6': layout }),
    pane(['settings']),
  );
  await page.keyboard.press('Alt+Shift+Digit6');
  await assertStopped(page);
  facts.push({ label: stage, stopped: true, page: await functionalSearch(page) });
  await proof.dispose();

  stage = 'disable while retained';
  proof = await fresh();
  await nativeHome(page);
  facts.push(await proof.check('before disable'));
  facts.push({ label: stage, stopped: true, ...(await disableThroughSettings(page, sw)) });
  await proof.dispose();

  stage = 'Shorts fallback';
  proof = await fresh();
  await nativeSearch(page, 'cute cat shorts');
  facts.push(await proof.check('before Shorts'));
  const oldSource = await proof.video.evaluate((video) => video.currentSrc);
  const short = page.locator('[ytenrich-slot=page] a[href^="/shorts/"]:visible').first();
  await short.waitFor();
  const shortHref = await short.getAttribute('href');
  assert(shortHref, 'Search exposes a native Shorts link');
  const shortPath = new URL(shortHref, page.url()).pathname;
  await startNavigation(page);
  await short.click();
  await page.waitForURL((url) => url.pathname === shortPath);
  await finishNavigation(page);
  await page.locator('ytd-shorts[ytenrich-slot=page]').waitFor();
  await page.waitForFunction(() => !document.documentElement.hasAttribute('ytenrich-session'));
  assert.equal(await page.locator('ytenrich-root .tab[data-view=player]').count(), 0);
  assert(
    await proof.video.evaluate(
      (video, source) =>
        video.paused ||
        video.ended ||
        !video.isConnected ||
        Boolean(video.closest('ytd-shorts')) ||
        video.currentSrc !== source,
      oldSource,
    ),
    'The original retained playback was stopped or handed to the native Shorts player',
  );
  const shortsVideo = await page
    .locator('ytd-shorts[ytenrich-slot=page] video:visible')
    .first()
    .elementHandle();
  assert(shortsVideo, 'The native Shorts tile contains a video');
  await progress(shortsVideo as ElementHandle<HTMLVideoElement>);
  facts.push({
    label: stage,
    path: shortPath,
    audible: await noTwoSounds(page),
    nativePlaying: true,
  });
  await page.screenshot({ path: 'tmp/smoke-session-shorts.png' });
  await shortsVideo.dispose();
  await proof.dispose();
  assert.deepEqual(errors, []);
  console.log(JSON.stringify({ modes: facts, errors }, null, 1));
} catch (error) {
  await page.screenshot({ path: 'tmp/smoke-session-modes-failure.png' });
  console.error(JSON.stringify({ failedAt: stage, facts, errors }, null, 1));
  throw error;
} finally {
  await ctx.close();
}
