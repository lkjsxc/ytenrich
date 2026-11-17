// Shared assertions for the live session smoke. No fixture replaces the site's media or router.
import assert from 'node:assert/strict';
import type { ElementHandle, Page, Worker } from 'playwright';
import { rect } from './smoke-lib.ts';
import { advance, observeMedia } from './smoke-session-media.ts';

export const readyVideo = async (page: Page): Promise<ElementHandle<HTMLVideoElement>> => {
  const node = page.locator('[ytenrich-slot=player] #movie_player video').first();
  await node.waitFor({ state: 'attached' });
  const media = (await node.elementHandle()) as ElementHandle<HTMLVideoElement>;
  assert(media, 'The projected player must contain a real video');
  await advance(media);
  return media;
};

export async function createSessionProof(page: Page) {
  const media = await readyVideo(page);
  const origin = await page.evaluate(() => performance.timeOrigin);
  const document = await page.evaluateHandle(() => globalThis.document);
  const observed = await media.evaluateHandle(observeMedia);
  const sample = () =>
    observed.evaluate(({ video, snapshot }) => ({
      ...snapshot(),
      source: video.currentSrc,
      time: video.currentTime,
      paused: video.paused,
      playing: [...globalThis.document.querySelectorAll('video')].filter(
        (v) => !v.paused && !v.ended,
      ).length,
    }));
  let rectangle = await rect(page, '[ytenrich-slot=player]');
  assert(rectangle, 'Player has a rectangle');
  assert.equal(rectangle, await rect(page, 'shadow:.body[data-view=player]'));
  let previous = await sample();
  let viewportBaseline = false;
  const cases = new Set<string>(); // bound: the two observed media kinds, content and advertisement
  cases.add(previous.ad ? 'advertisement' : 'content');
  const check = async (label: string, pageTile = true) => {
    if (pageTile) {
      const path = new URL(page.url()).pathname;
      const native =
        path === '/results'
          ? 'ytd-search'
          : path === '/'
            ? 'ytd-browse[page-subtype=home]'
            : 'ytd-browse[page-subtype=channels]';
      await page.locator(`${native}[ytenrich-slot=page]:not([ytenrich-slot-inactive])`).waitFor();
    } else await page.locator('ytd-watch-flexy:not([hidden])').waitFor({ state: 'attached' });
    await advance(media);
    const now = await sample();
    cases.add(now.ad ? 'advertisement' : 'content');
    assert.equal(await document.evaluate((saved) => saved === globalThis.document), true, label);
    assert.equal(
      await page.evaluate(() => performance.timeOrigin),
      origin,
      'No document navigation',
    );
    assert.equal(
      await media.evaluate((v) => v === globalThis.document.querySelector('#movie_player video')),
      true,
      'Same media element',
    );
    assert.equal(now.paused, false, label);
    assert.equal(now.playing, 1, 'Exactly one video is playing');
    const adTransition = now.adPhases > previous.adPhases || now.adChanges > previous.adChanges;
    const changed = now.source !== previous.source || now.ad !== previous.ad || adTransition;
    if (changed) {
      assert(
        adTransition || ((previous.ad || now.ad) && now.counts.ended > previous.counts.ended),
        'Source changes must be an observed ad transition, never a navigation restart',
      );
    } else {
      assert(now.time > previous.time, 'Playback position advances without restarting');
      for (const event of ['pause', 'emptied', 'seeking'] as const)
        assert.equal(now.counts[event], previous.counts[event], `No ${event} across ${label}`);
    }
    assert.equal(
      await rect(page, '[ytenrich-slot=player]'),
      rectangle,
      'Player rectangle is unchanged',
    );
    assert.equal(
      await rect(page, 'shadow:.body[data-view=player]'),
      rectangle,
      'Player tile is unchanged',
    );
    if (pageTile) {
      assert.equal(
        await rect(page, '[ytenrich-slot=page]'),
        await rect(page, 'shadow:.body[data-view=page]'),
      );
      assert(
        await page
          .locator('[ytenrich-slot=page]')
          .evaluate((el) => el.matches('ytd-page-manager > :not([hidden], ytd-watch-flexy)')),
        'Page tile is the active native page',
      );
    }
    previous = now;
    const rebased = viewportBaseline;
    viewportBaseline = false;
    return {
      label,
      url: page.url(),
      rectangle,
      time: now.time,
      ad: now.ad,
      mediaTransition: changed,
      adPhases: now.adPhases,
      adChanges: now.adChanges,
      adPod: now.adPod,
      viewportBaseline: rebased,
      events: now.counts,
      cases: [...cases],
    };
  };
  return {
    check,
    async rebase() {
      await page.waitForTimeout(350); // the existing projector batches YouTube's resize notification
      await advance(media);
      assert.equal(await document.evaluate((saved) => saved === globalThis.document), true);
      assert.equal(
        await media.evaluate((v) => v === globalThis.document.querySelector('#movie_player video')),
        true,
      );
      // A new viewport starts a new navigation-proof baseline; native quality changes are not navigations.
      previous = await sample();
      viewportBaseline = true;
      cases.add(previous.ad ? 'advertisement' : 'content');
      rectangle = await rect(page, '[ytenrich-slot=player]');
      assert(rectangle);
    },
    rectangle: () => rectangle,
    async dispose() {
      await observed.evaluate((state) => state.dispose());
      await observed.dispose();
      await media.dispose();
      await document.dispose();
    },
  };
}

/** Read both the Stats counter and the corresponding History event count, without altering either. */
export const openTotals = (sw: Worker, id: string): Promise<{ opened: number; events: number }> =>
  sw.evaluate(
    (video) =>
      new Promise<{ opened: number; events: number }>((resolve, reject) => {
        const request = indexedDB.open('ytenrich');
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
          const db = request.result;
          const tx = db.transaction(['videos', 'opens']);
          const row = tx.objectStore('videos').get(video);
          const events = tx
            .objectStore('opens')
            .index('video')
            .count(IDBKeyRange.bound([video, 0, ''], [video, Number.MAX_SAFE_INTEGER, '\uffff']));
          tx.oncomplete = () => {
            db.close();
            resolve({ opened: row.result?.opened ?? 0, events: events.result });
          };
          tx.onabort = () => {
            db.close();
            reject(tx.error);
          };
        };
      }),
    id,
  );

export async function assertStopped(page: Page): Promise<void> {
  await page.waitForFunction(() => {
    const shadow = document.querySelector('ytenrich-root')?.shadowRoot;
    return (
      !document.documentElement.hasAttribute('ytenrich-session') &&
      !shadow?.querySelector('.tab[data-view=player]') &&
      [...document.querySelectorAll('video')].every((v) => v.paused || v.ended)
    );
  });
}
