// Music has the same per-origin bounds as YouTube, including backup restores.
import { MAX_CHANNELS, MAX_VIDEOS } from '../shared/stats-rules.ts';
import { done, walk } from './db.ts';
import { capOpens, removeOpens } from './history.ts';
export async function pruneMusic(tx: IDBTransaction): Promise<void> {
  const videos = tx.objectStore('music-videos');
  let excess = (await done(videos.count())) - MAX_VIDEOS;
  if (excess > 0)
    await walk(videos.index('lastSeen'), null, 'next', (c) => {
      c.delete();
      removeOpens(tx, c.value.id, 'music');
      return --excess > 0;
    });
  const channels = tx.objectStore('music-channels');
  let extra = (await done(channels.count())) - MAX_CHANNELS;
  if (extra > 0)
    await walk(channels.index('lastSeen'), null, 'next', (c) => {
      c.delete();
      return --extra > 0;
    });
  await capOpens(tx, undefined, 'music');
}
