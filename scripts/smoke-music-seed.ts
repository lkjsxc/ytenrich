// Add deterministic prior days/repeats after the controlled media starts have been asserted.
import type { Worker } from 'playwright';
export async function seedMusic(sw: Worker): Promise<void> {
  await sw.evaluate(async () => {
    const req = indexedDB.open('ytenrich');
    const db = await new Promise<IDBDatabase>((r) => {
      req.onsuccess = () => r(req.result);
    });
    const tx = db.transaction(
      ['music-videos', 'music-opens', 'music-days', 'music-channels'],
      'readwrite',
    );
    const videos = tx.objectStore('music-videos');
    const get = videos.get('dQw4w9WgXcQ');
    get.onsuccess = () => {
      const row = get.result;
      videos.put({
        ...row,
        opened: 4,
        thumbnail: 'https://i.ytimg.com/vi/dQw4w9WgXcQ/mqdefault.jpg',
      });
      const days = tx.objectStore('music-days');
      const existing = days.openCursor();
      existing.onsuccess = () => {
        const c = existing.result;
        if (c)
          for (let i = 1; i <= 3; i++) {
            const time = Date.now() - i * 86400000;
            const d = new Date(time),
              pad = (n: number) => String(n).padStart(2, '0');
            const day = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
            const hours = new Array<number>(24).fill(0);
            hours[d.getHours()] = 1;
            days.put({ ...c.value, day, opened: 1, hours });
            tx.objectStore('music-opens').put({
              id: `seed-${i}`,
              video: row.id,
              origin: 'music',
              time,
            });
          }
      };
      const channels = tx.objectStore('music-channels');
      const artist = channels.get('Rick Astley');
      artist.onsuccess = () => channels.put({ ...artist.result, opened: 4 });
    };
    await new Promise<void>((r, reject) => {
      tx.oncomplete = () => r();
      tx.onabort = () => reject(tx.error);
    });
    db.close();
    await chrome.storage.local.set({ statsRev: Date.now() });
  });
}
