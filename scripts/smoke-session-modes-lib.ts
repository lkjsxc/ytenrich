// Additional live-mode assertions, independent of Page's route-specific smoke selectors.
import assert from 'node:assert/strict';
import type { ElementHandle, Page } from 'playwright';
import { rect } from './smoke-lib.ts';
import { assertFullscreenAllocation } from './smoke-session-fullscreen.ts';
import { readyVideo } from './smoke-session-lib.ts';
import { finishLiveAd } from './smoke-session-live.ts';
import { observeMedia } from './smoke-session-media.ts';
import { finishNavigation, startNavigation } from './smoke-session-navigation.ts';

export async function progress(video: ElementHandle<HTMLVideoElement>): Promise<void> {
  await video.evaluate(
    (v) =>
      new Promise<void>((resolve, reject) => {
        let source = v.currentSrc;
        let from = v.currentTime;
        const finish = (error?: Error): void => {
          clearTimeout(timer);
          v.removeEventListener('timeupdate', tick);
          error ? reject(error) : resolve();
        };
        const tick = (): void => {
          if (source !== v.currentSrc) {
            source = v.currentSrc;
            from = v.currentTime;
          }
          if (!v.paused && !v.seeking && v.currentTime > from + 0.2) finish();
        };
        const timer = setTimeout(
          () => finish(new Error('No media progress in 12 seconds')),
          12_000,
        );
        v.addEventListener('timeupdate', tick);
      }),
  );
}

export async function createModeProof(page: Page) {
  const video = await readyVideo(page);
  const origin = await page.evaluate(() => performance.timeOrigin);
  const rectangle = await rect(page, '[ytenrich-slot=player]');
  assert(rectangle);
  const observed = await video.evaluateHandle(observeMedia);
  const sample = () =>
    observed.evaluate(({ video: v, snapshot }) => {
      const r = v.getBoundingClientRect();
      const allocation = v.closest('#movie_player')?.getBoundingClientRect();
      return {
        time: v.currentTime,
        source: v.currentSrc,
        ...snapshot(),
        visible:
          v.isConnected && v.checkVisibility({ visibilityProperty: true, opacityProperty: true }),
        decoded: v.videoWidth > 0 && v.videoHeight > 0,
        same: v === document.querySelector('#movie_player video'),
        playing: [...document.querySelectorAll('video')].filter((v) => !v.paused && !v.ended)
          .length,
        inViewport:
          r.width > 0 &&
          r.height > 0 &&
          r.bottom > 0 &&
          r.right > 0 &&
          r.left < innerWidth &&
          r.top < innerHeight,
        fullscreenContains: Boolean(document.fullscreenElement?.contains(v)),
        allocation: allocation
          ? [allocation.x, allocation.y, allocation.width, allocation.height]
          : [],
        viewport: [innerWidth, innerHeight],
        geometry: [r.x, r.y, r.width, r.height],
      };
    });
  let previous = await sample();
  return {
    video,
    async check(label: string, fullscreen = false) {
      await page.mouse.move(0, 0);
      await progress(video);
      const now = await sample();
      assert.equal(await page.evaluate(() => performance.timeOrigin), origin, label);
      assert(
        now.same && now.visible && now.decoded && now.inViewport,
        'The original media is connected, visible, decoded and inside the viewport',
      );
      assert.equal(now.playing, 1, 'Exactly one video plays');
      const adTransition = now.adPhases > previous.adPhases || now.adChanges > previous.adChanges;
      const transition = now.source !== previous.source || now.ad !== previous.ad || adTransition;
      if (transition)
        assert(
          adTransition || ((previous.ad || now.ad) && now.counts.ended > previous.counts.ended),
          'Only an observed ad phase change or ended ad permits a source reset',
        );
      else {
        assert(now.time > previous.time, 'The retained position advances');
        for (const event of ['pause', 'emptied', 'seeking'] as const)
          assert.equal(now.counts[event], previous.counts[event], `No ${event} across ${label}`);
      }
      if (fullscreen) {
        assert(now.fullscreenContains, 'The fullscreen element contains the video');
        assertFullscreenAllocation(now.geometry, now.allocation, now.viewport);
        assert.equal(
          await page.locator('[ytenrich-slot]').count(),
          0,
          'Fullscreen releases projection',
        );
        assert.equal(await page.locator('ytenrich-root').count(), 0, 'Fullscreen releases the WM');
      } else {
        assert.equal(await rect(page, '[ytenrich-slot=player]'), rectangle, label);
        assert.equal(await rect(page, 'shadow:.body[data-view=player]'), rectangle, label);
      }
      previous = now;
      return {
        label,
        url: page.url(),
        time: now.time,
        ad: now.ad,
        transition,
        rectangle,
        fullscreen,
        geometry: now.geometry,
        nativeAllocation: now.allocation,
        events: now.counts,
        adPhases: now.adPhases,
        adChanges: now.adChanges,
        adPod: now.adPod,
      };
    },
    async dispose() {
      await observed.evaluate((state) => state.dispose());
      await observed.dispose();
      await video.dispose();
    },
  };
}

/** Native result badges distinguish actual live streams from recorded videos whose titles merely say "live". */
export async function chooseLive(page: Page): Promise<string> {
  const live = page
    .locator('[ytenrich-slot=page] :is(ytd-video-renderer, yt-lockup-view-model)')
    .filter({
      has: page
        .locator('.badge-style-type-live-now, [overlay-style=LIVE], [aria-label="LIVE"]')
        .or(
          page
            .locator('yt-badge-shape, yt-thumbnail-badge-view-model')
            .filter({ hasText: /^\s*LIVE\s*$/i }),
        ),
    })
    .locator('a[href^="/watch?v="]:visible')
    .first();
  await live.waitFor();
  const href = await live.getAttribute('href');
  assert(href, 'Search must expose a native live-marked watch link');
  const id = new URL(href, page.url()).searchParams.get('v');
  assert(id);
  await startNavigation(page);
  await live.click();
  await page.waitForURL((url) => url.pathname === '/watch' && url.searchParams.get('v') === id);
  await finishNavigation(page);
  await page
    .locator(`ytd-watch-flexy[video-id="${id}"]:not([hidden])`)
    .waitFor({ state: 'attached' });
  const media = await readyVideo(page);
  await media.dispose();
  const loaded = await page.evaluate(() => {
    const player = document.querySelector('#movie_player') as Element & {
      getVideoData?: () => { isLive?: boolean; video_id?: string };
    };
    const data = player?.getVideoData?.();
    return { id: data?.video_id, isLive: data?.isLive === true };
  });
  assert.equal(loaded.id, id, 'The chosen live result is the actual loaded content');
  assert.equal(loaded.isLive, true, 'The selected native result really is a live stream');
  await finishLiveAd(page);
  const content = await readyVideo(page);
  assert.equal(
    await content.evaluate((video) =>
      video.closest('#movie_player')?.classList.contains('ad-showing'),
    ),
    false,
    'Live mode scenarios start with the actual stream, after any native pre-roll',
  );
  await content.dispose();
  return id;
}
