// Seeded History smoke: real extension/WM, deterministic opens, dark tile >=480px wide.

import assert from 'node:assert/strict';
import { mkdirSync } from 'node:fs';
import { emptyStat } from '../src/shared/stats-rules.ts';
import { pane, split } from '../src/wm/layout.ts';
import { launch } from './smoke-lib.ts';

const { ctx, page, sw, errors } = await launch(
  { statsEnabled: false, introDone: true },
  { dark: true },
);
try {
  await ctx.addCookies([
    { name: 'PREF', value: 'hl=en&gl=US&f6=400', domain: '.youtube.com', path: '/' },
  ]);
  const now = new Date(2026, 10, 15, 18, 30).getTime();
  const video = 'dQw4w9WgXcQ';
  const times = [now, now - 4 * 3600_000, now - 86_400_000];
  const rows = [
    {
      ...emptyStat(video, now),
      title: 'Rick Astley - Never Gonna Give You Up',
      channel: 'Rick Astley',
      opened: 5,
      openedAt: now,
    },
    ...Array.from({ length: 20 }, (_, i) => ({
      ...emptyStat(`seed${i}`, now),
      title: `History video ${i + 1}`,
      channel: 'Seeded history',
      opened: 1,
      openedAt: now - (i + 1) * 60_000,
    })),
  ];
  const opens = [
    ...times.map((time, i) => ({ id: `repeat${i}`, video, time })),
    ...rows.slice(1).map((v, i) => ({ id: `single${i}`, video: v.id, time: v.openedAt })),
  ];
  await sw.evaluate(
    (layout) =>
      chrome.storage.local.set({
        'layout:watch': layout,
        introduced: ['recommended', 'playlist', 'chapters'],
      }),
    split('row', [pane(['player']), pane(['history'])], [0.6, 0.4]),
  );
  await page.goto(`https://www.youtube.com/watch?v=${video}`, { waitUntil: 'domcontentloaded' });
  const tile = page.locator('ytenrich-root .body[data-view=history]');
  await tile.waitFor();
  await sw.evaluate(
    async ({ rows, opens }) => {
      await new Promise<void>((resolve, reject) => {
        const req = indexedDB.open('ytenrich');
        req.onsuccess = () => {
          const tx = req.result.transaction(['videos', 'opens'], 'readwrite');
          tx.objectStore('videos').clear();
          tx.objectStore('opens').clear();
          for (const row of rows) tx.objectStore('videos').put(row);
          for (const event of opens) tx.objectStore('opens').put(event);
          tx.oncomplete = () => {
            req.result.close();
            resolve();
          };
          tx.onabort = () => reject(tx.error);
        };
        req.onerror = () => reject(req.error);
      });
      await chrome.storage.local.set({ statsRev: Date.now() });
    },
    { rows, opens },
  );
  const mark = tile.locator('.hcount').first();
  await mark.waitFor();
  await mark.focus();
  await page.keyboard.press('Enter');
  await tile.locator('.hopens:not([hidden]) button').first().waitFor();
  const before = await tile.evaluate((el) => {
    (el as HTMLElement & { saved?: Element }).saved = el.querySelectorAll('.hrow')[1];
    return el.scrollTop;
  });
  await mark.click();
  assert.equal(await tile.evaluate((el) => el.scrollTop), before);
  await mark.click();
  await tile.locator('.hopens:not([hidden]) button').first().waitFor();
  assert(
    await tile.evaluate(
      (el) => (el as HTMLElement & { saved?: Element }).saved === el.querySelectorAll('.hrow')[1],
    ),
  );
  await sw.evaluate(() => chrome.storage.local.set({ statsRev: Date.now() }));
  await page.waitForTimeout(500);
  assert.equal(await mark.getAttribute('aria-expanded'), 'true');
  assert.match(
    (await tile.locator('.hopens:not([hidden])').first().textContent()) ?? '',
    /\+ 2 earlier, time not recorded/,
  );
  assert((await tile.boundingBox())!.width >= 480);
  assert.equal(await page.locator('ytenrich-root').getAttribute('theme'), 'dark');
  mkdirSync('tmp/shots', { recursive: true });
  await page.mouse.move(0, 0);
  await mark.blur();
  await tile.locator('..').screenshot({ path: 'tmp/shots/history-opens.png' });
  console.log(
    JSON.stringify({
      historyRows: await tile.locator('.hrow').count(),
      width: (await tile.boundingBox())!.width,
      expanded: true,
      errors,
    }),
  );
} finally {
  await ctx.close();
}
