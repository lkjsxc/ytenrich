// Controlled real-media playback through Music's kept DOM player and the extension, then seeded dark tiles.
// Signed-out Music can withhold media streams; this smoke does not claim to verify those streams.
import assert from 'node:assert/strict';
import { mkdirSync } from 'node:fs';
import { pane, split } from '../src/wm/layout.ts';
import { launch } from './smoke-lib.ts';
import { seedMusic } from './smoke-music-seed.ts';

export async function musicRecordSmoke(): Promise<void> {
  const { ctx, page, sw, errors } = await launch(
    { introDone: true, statsEnabled: false },
    { desktopUa: true, dark: true },
  );
  try {
    await sw.evaluate(
      (layout) => chrome.storage.local.set({ 'layout:music': layout }),
      split('row', [pane(['page', 'music-player']), pane(['history', 'stats'])], [0.35, 0.65]),
    );
    await page.goto('https://music.youtube.com/watch?v=dQw4w9WgXcQ', {
      waitUntil: 'domcontentloaded',
    });
    await page.locator('ytmusic-player video').waitFor({ state: 'attached' });
    await page.waitForTimeout(5000);
    const native = await page.locator('ytmusic-player video').evaluate((v: HTMLVideoElement) => ({
      source: Boolean(v.currentSrc),
      playing: !v.paused,
      seconds: v.currentTime,
    }));
    // Use a 12-second silent PCM source so media time really advances; no synthetic timeupdate/clock jumps.
    await page.evaluate(() => {
      const old = document.querySelector('ytmusic-player video')!;
      const v = document.createElement('video');
      v.dataset.musicSmoke = '';
      v.muted = true;
      const rate = 8000,
        size = rate * 12 * 2;
      const bytes = new Uint8Array(44 + size);
      const view = new DataView(bytes.buffer);
      const str = (at: number, s: string) =>
        [...s].forEach((c, i) => view.setUint8(at + i, c.charCodeAt(0)));
      str(0, 'RIFF');
      view.setUint32(4, 36 + size, true);
      str(8, 'WAVE');
      str(12, 'fmt ');
      view.setUint32(16, 16, true);
      view.setUint16(20, 1, true);
      view.setUint16(22, 1, true);
      view.setUint32(24, rate, true);
      view.setUint32(28, rate * 2, true);
      view.setUint16(32, 2, true);
      view.setUint16(34, 16, true);
      str(36, 'data');
      view.setUint32(40, size, true);
      v.src = URL.createObjectURL(new Blob([bytes], { type: 'audio/wav' }));
      old.replaceWith(v);
    });
    await sw.evaluate(() =>
      chrome.storage.local.set({ settings: { introDone: true, statsEnabled: true } }),
    );
    await page.waitForTimeout(100);
    for (const [id, title, artist] of [
      ['dQw4w9WgXcQ', 'Never Gonna Give You Up', 'Rick Astley'],
      ['djV11Xbc914', 'Take On Me', 'a-ha'],
    ]) {
      await page.evaluate(
        async ({ id, title, artist }) => {
          const player = document.querySelector('ytmusic-player')!;
          player.querySelectorAll('.ad-showing').forEach((el) => el.classList.remove('ad-showing'));
          player.querySelector<HTMLAnchorElement>('.ytp-title-link')!.href =
            `https://music.youtube.com/watch?v=${id}`;
          const cover = player.querySelector<HTMLImageElement>('#song-image img');
          if (cover) cover.src = `https://i.ytimg.com/vi/${id}/mqdefault.jpg`;
          const bar = document.querySelector('ytmusic-player-bar')!;
          for (const [name, text] of [
            ['title', title],
            ['byline', artist],
          ]) {
            const el =
              bar.querySelector(`.${name}`) ?? bar.appendChild(document.createElement('span'));
            el.className = name!;
            el.textContent = text!;
          }
          const v = player.querySelector<HTMLVideoElement>('video[data-music-smoke]')!;
          v.currentTime = 0;
          await v.play();
        },
        { id: id!, title: title!, artist: artist! },
      );
      await page.waitForFunction(
        () =>
          (document.querySelector('video[data-music-smoke]') as HTMLVideoElement)?.currentTime >=
          10.5,
        undefined,
        { timeout: 18000 },
      );
      await page.locator('video[data-music-smoke]').evaluate((v: HTMLVideoElement) => v.pause());
    }
    const history = page.locator('ytenrich-root .body[data-view=history]');
    await history.locator('.hrow').nth(1).waitFor({ timeout: 10000 });
    assert.equal(await history.locator('.hrow').count(), 2);
    assert.match((await history.textContent()) ?? '', /Take On Me/);
    assert.match((await history.textContent()) ?? '', /Rick Astley/);
    const rows = await sw.evaluate(async () => {
      const req = indexedDB.open('ytenrich');
      const db = await new Promise<IDBDatabase>((r) => {
        req.onsuccess = () => r(req.result);
      });
      const tx = db.transaction(['music-videos', 'videos']);
      const get = (store: string) =>
        new Promise<unknown[]>((r) => {
          const q = tx.objectStore(store).getAll();
          q.onsuccess = () => r(q.result);
        });
      const result = { music: await get('music-videos'), youtube: await get('videos') };
      db.close();
      return result;
    });
    assert.equal(rows.music.length, 2);
    assert.equal(rows.youtube.length, 0);
    // Seed a repeated play for ×N/unfold, plus prior days for the Stats charts.
    await seedMusic(sw);
    await history.locator('.hcount').first().waitFor();
    await history.locator('.hcount').first().click();
    await history.locator('.hopens:not([hidden]) button').nth(3).waitFor();
    assert.equal(await history.locator('.hrow').count(), 5);
    assert.equal(await page.locator('ytenrich-root').getAttribute('theme'), 'dark');
    mkdirSync('tmp/shots', { recursive: true });
    await page.screenshot({ path: 'tmp/shots/music-history.png' });
    await page.locator('ytenrich-root .tab[data-view=stats]').click();
    const stats = page.locator('ytenrich-root .body[data-view=stats]');
    await stats.locator('.tile b').waitFor();
    assert.equal(await stats.locator('.tile b').textContent(), '5');
    const text = (await stats.textContent()) ?? '';
    assert.match(text, /Rick Astley/);
    assert.match(text, /a-ha/);
    assert.doesNotMatch(
      text,
      /Recommendations shown|Pick rate|Hidden by ytenrich|Not interested|Still recommended|Shown/,
    );
    await page.screenshot({ path: 'tmp/shots/music-stats.png' });
    assert.deepEqual(errors, []);
    console.log(
      JSON.stringify({
        musicRecord: {
          controlledMediaTracks: 2,
          historyRows: 5,
          opened: 5,
          separated: true,
          native,
          errors,
        },
      }),
    );
  } finally {
    await ctx.close();
  }
}
