// Existing records came from YouTube. Only explicit Music provenance justifies moving a row.
import { BASES, storeOf } from './origin.ts';
export function upgradeOrigins(tx: IDBTransaction): void {
  for (const name of BASES) {
    const source = tx.objectStore(name);
    const req = source.openCursor();
    req.onsuccess = () => {
      const c = req.result;
      if (!c) return;
      const raw = c.value;
      const save = (music: boolean): void => {
        const row = { ...raw, origin: music ? 'music' : 'youtube' };
        if (music) {
          tx.objectStore(storeOf(name, 'music')).put(row);
          c.delete();
        } else c.update(row);
        c.continue();
      };
      if (name === 'opens' && raw.origin === undefined) {
        const get = tx.objectStore('videos').get(raw.video);
        get.onsuccess = () => {
          if (get.result) save(get.result.origin === 'music');
          else {
            const music = tx.objectStore('music-videos').get(raw.video);
            music.onsuccess = () => save(Boolean(music.result));
          }
        };
      } else save(raw.origin === 'music');
    };
  }
}
