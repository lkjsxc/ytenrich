// Real network playback is reported separately from the deterministic controlled-media smoke.
import assert from 'node:assert/strict';
import type { Page, Worker } from 'playwright';
export async function nativeMusicPlay(page: Page): Promise<string | null> {
  try {
    await page.waitForFunction(
      () => {
        const p = document.querySelector('ytmusic-player');
        const v = p?.querySelector('video');
        return v && !p?.querySelector('.ad-showing') && !v.paused && v.currentTime >= 11;
      },
      undefined,
      { timeout: 35000 },
    );
    return await page
      .locator('ytmusic-player .ytp-title-link')
      .evaluate((a: HTMLAnchorElement) => new URL(a.href).searchParams.get('v'));
  } catch {
    return null;
  }
}
export async function assertNativeMusic(
  sw: Worker,
  ids: readonly (string | null)[],
): Promise<void> {
  const tracks = ids.filter((id): id is string => Boolean(id));
  if (tracks.length < 2 || new Set(tracks).size < 2) {
    console.log(
      JSON.stringify({
        nativeMusicRecord: {
          verified: false,
          reason:
            'Two distinct tracks did not reach 11 seconds of non-ad native playback in this signed-out session.',
          tracks,
        },
      }),
    );
    return;
  }
  const opened = await sw.evaluate(async () => {
    const req = indexedDB.open('ytenrich');
    const db = await new Promise<IDBDatabase>((r) => {
      req.onsuccess = () => r(req.result);
    });
    const rows = await new Promise<{ video: string }[]>((r) => {
      const get = db.transaction('music-opens').objectStore('music-opens').getAll();
      get.onsuccess = () => r(get.result);
    });
    db.close();
    return rows.map((row) => row.video);
  });
  for (const id of tracks) assert(opened.includes(id), `Missing native Music play: ${id}`);
  console.log(JSON.stringify({ nativeMusicRecord: { verified: true, tracks } }));
}
