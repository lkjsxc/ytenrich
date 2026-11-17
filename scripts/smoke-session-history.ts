// Own-view navigation must cover a recorded video absent from the currently scanned native cards.
import assert from 'node:assert/strict';
import type { Page, Worker } from 'playwright';
import { rect } from './smoke-lib.ts';
import { openTotals, readyVideo } from './smoke-session-lib.ts';

export async function openOwnHistory(
  page: Page,
  sw: Worker,
  id: string,
  origin: number,
  rectangle: string | null,
) {
  const acknowledgement = await page.evaluateHandle(() => {
    const state = { accepted: 0 };
    document.addEventListener(
      'ytenrich-navigate-watch',
      (event) => {
        if ((event.target as Element)?.getAttribute('ytenrich-navigation') === 'accepted')
          state.accepted++;
      },
      { once: true },
    );
    return state;
  });
  try {
    await page.locator('ytenrich-root .tab[data-view=history]').click();
    await page
      .locator(
        `ytenrich-root .body[data-view=history] a[href="https://www.youtube.com/watch?v=${id}"]`,
      )
      .first()
      .click();
    await page.waitForURL((url) => url.pathname === '/watch' && url.searchParams.get('v') === id);
    await page
      .locator(`ytd-watch-flexy[video-id="${id}"]:not([hidden])`)
      .waitFor({ state: 'attached' });
    const video = await readyVideo(page);
    assert.equal(
      await video.evaluate((video) => {
        const player = video.closest('#movie_player') as Element & {
          getVideoData?: () => { video_id?: string };
        };
        return player?.getVideoData?.().video_id;
      }),
      id,
      'History loaded the chosen content video, including during its pre-roll',
    );
    await video.dispose();
    assert.equal(
      await acknowledgement.evaluate((s) => s.accepted),
      1,
      'The own History card used the acknowledged bridge',
    );
    assert.equal(
      await page.evaluate(() => performance.timeOrigin),
      origin,
      'History did not reload the document',
    );
    assert.equal(
      await rect(page, '[ytenrich-slot=player]'),
      rectangle,
      'History replaces the video in the same tile',
    );
    assert.equal(
      await page.evaluate(
        () => [...document.querySelectorAll('video')].filter((v) => !v.paused && !v.ended).length,
      ),
      1,
      'History never leaves two videos playing',
    );
    const totals = await openTotals(sw, id);
    assert.deepEqual(
      totals,
      { opened: 2, events: 2 },
      'Choosing the original again records its second actual open',
    );
    return { label: 'own-history', id, accepted: 1, sameDocument: true, rectangle, totals };
  } finally {
    await acknowledgement.dispose();
  }
}
