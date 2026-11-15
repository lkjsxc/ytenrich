// A qualified Music start is an open, atomically counted by track, day and artist.
import { addChannel, addDay, emptyStat } from '../shared/stats-rules.ts';
import {
  type ChannelStat,
  type DayStat,
  dayKey,
  type MusicPlay,
  type VideoStat,
} from '../shared/types.ts';
import { complete, done, openDb } from './db.ts';
import { pruneMusic } from './music-prune.ts';
import { BASES, storeOf } from './origin.ts';

export async function played(play: MusicPlay): Promise<void> {
  const tx = (await openDb()).transaction(
    BASES.map((s) => storeOf(s, 'music')),
    'readwrite',
  );
  const videos = tx.objectStore('music-videos');
  const prev = await done<VideoStat | undefined>(videos.get(play.id));
  const s = prev ?? emptyStat(play.id, play.time);
  const { time, ...metadata } = play;
  videos.put({
    ...s,
    ...metadata,
    origin: 'music',
    opened: s.opened + 1,
    openedAt: time,
    lastSeen: play.time,
  });
  tx.objectStore('music-opens').add({
    id: crypto.randomUUID(),
    video: play.id,
    time: play.time,
    origin: 'music',
  });
  const days = tx.objectStore('music-days');
  const day = addDay(await done<DayStat | undefined>(days.get(dayKey(play.time))), play.time, {
    opened: 1,
  });
  day.hours[new Date(play.time).getHours()]!++;
  days.put({ ...day, origin: 'music' });
  if (play.channel) {
    const channels = tx.objectStore('music-channels');
    const old = await done<ChannelStat | undefined>(channels.get(play.channel));
    channels.put({
      ...addChannel(old, play.channel, play.time, { opened: 1, videos: prev ? 0 : 1 }),
      origin: 'music',
      lastSeen: play.time,
    });
  }
  await pruneMusic(tx);
  await complete(tx);
}
