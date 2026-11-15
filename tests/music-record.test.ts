import { IDBFactory, IDBKeyRange } from 'fake-indexeddb';
import { beforeEach, expect, it, vi } from 'vitest';
import { dayKey } from '../src/shared/types.ts';

beforeEach(() => {
  vi.resetModules();
  vi.stubGlobal('indexedDB', new IDBFactory());
  vi.stubGlobal('IDBKeyRange', IDBKeyRange);
});
const play = {
  id: 'same',
  title: 'Music title',
  channel: 'Artist',
  thumbnail: 'https://i.ytimg.com/vi/same/default.jpg',
  duration: 180,
  time: Date.now(),
};
it('keeps both histories, counts, artists, queries and recommendation taste separate for the same id', async () => {
  const { played } = await import('../src/background/music-repo.ts');
  const repo = await import('../src/background/stats-repo.ts');
  const read = await import('../src/background/stats-read.ts');
  const history = await import('../src/background/history.ts');
  const { recommend } = await import('../src/background/recommend.ts');
  await repo.opened({ ...play, title: 'YouTube title', kind: 'video' });
  const q = {
    kinds: ['video'] as const,
    channel: '',
    group: true,
    opened: true,
    order: 'ranked' as const,
    text: '',
  };
  const before = await recommend(q, 10, () => false);
  await played(play);
  await played({ ...play, time: play.time + 1000 });
  const music = await history.history({ origin: 'music', search: '', limit: 10 });
  const youtube = await history.history({ search: '', limit: 10 });
  expect(music.rows).toHaveLength(2);
  expect(youtube.rows).toHaveLength(1);
  expect(music.rows[0]?.row).toMatchObject({
    origin: 'music',
    opened: 2,
    title: 'Music title',
    thumbnail: play.thumbnail,
    duration: 180,
  });
  expect(youtube.rows[0]?.row).toMatchObject({
    origin: 'youtube',
    opened: 1,
    title: 'YouTube title',
  });
  expect(await history.videoOpens('same', 'music')).toHaveLength(2);
  const m = await read.overview(Infinity, 'music');
  const y = await read.overview(Infinity);
  expect(m.days[0]?.opened).toBe(2);
  expect(y.days[0]?.opened).toBe(1);
  expect(m.days[0]?.hours.reduce((a, b) => a + b, 0)).toBe(2);
  expect(await read.channels('opened', 10, 'music')).toMatchObject([
    { name: 'Artist', opened: 2, origin: 'music' },
  ]);
  expect(await read.channels('opened', 10)).toMatchObject([
    { name: 'Artist', opened: 1, origin: 'youtube' },
  ]);
  const base = {
    sort: 'opened' as const,
    filter: 'all' as const,
    kind: 'all' as const,
    channel: '',
    search: '',
    limit: 10,
  };
  expect((await read.query(base, Infinity)).rows[0]?.title).toBe('YouTube title');
  expect((await read.query({ ...base, origin: 'music' }, Infinity)).rows[0]?.title).toBe(
    'Music title',
  );
  const { touch } = await import('../src/background/recommend.ts');
  touch();
  expect(await recommend(q, 10, () => false)).toEqual(before);
});
it('v5 adds Music stores, defaults legacy rows to youtube and preserves explicit Music provenance', async () => {
  await new Promise<void>((resolve) => {
    const req = indexedDB.open('ytenrich', 4);
    req.onupgradeneeded = () => {
      const db = req.result;
      const videos = db.createObjectStore('videos', { keyPath: 'id' });
      const days = db.createObjectStore('days', { keyPath: 'day' });
      db.createObjectStore('channels', { keyPath: 'name' });
      const opens = db.createObjectStore('opens', { keyPath: 'id' });
      opens.createIndex('time', ['time', 'id']);
      opens.createIndex('video', ['video', 'time', 'id']);
      videos.put({ ...play, opened: 3 });
      videos.put({ ...play, id: 'music', origin: 'music', opened: 2 });
      days.put({ day: dayKey(play.time), opened: 3 });
      opens.put({ id: 'old', video: 'same', time: play.time });
      opens.put({ id: 'known', video: 'music', time: play.time });
    };
    req.onsuccess = () => {
      req.result.close();
      resolve();
    };
  });
  const db = await import('../src/background/db.ts');
  const conn = await db.openDb();
  const tx = conn.transaction(['videos', 'opens', 'music-videos', 'music-opens', 'days']);
  expect(await db.done(tx.objectStore('videos').get('same'))).toMatchObject({
    origin: 'youtube',
    opened: 3,
  });
  expect(await db.done(tx.objectStore('music-videos').get('music'))).toMatchObject({
    origin: 'music',
    opened: 2,
  });
  expect(await db.done(tx.objectStore('opens').get('old'))).toMatchObject({ origin: 'youtube' });
  expect(await db.done(tx.objectStore('music-opens').get('known'))).toMatchObject({
    origin: 'music',
  });
  expect(await db.done(tx.objectStore('days').get(dayKey(play.time)))).toMatchObject({
    origin: 'youtube',
    opened: 3,
  });
});

it('exports and restores both origins, including Music metadata and repeat times', async () => {
  const { played } = await import('../src/background/music-repo.ts');
  const repo = await import('../src/background/stats-repo.ts');
  const backup = await import('../src/background/backup.ts');
  const { STORES } = await import('../src/background/origin.ts');
  const read = await import('../src/background/history.ts');
  await played(play);
  await played({ ...play, time: play.time + 1000 });
  await repo.opened({ ...play, kind: 'video' });
  const data = await Promise.all(STORES.map((s) => backup.dump(s, null, 100)));
  await repo.clear();
  expect((await read.history({ origin: 'music', limit: 10, search: '' })).rows).toEqual([]);
  for (const [i, s] of STORES.entries()) await backup.restore(s, data[i]!.rows);
  expect(await read.videoOpens(play.id, 'music')).toHaveLength(2);
  expect(await read.videoOpens(play.id)).toHaveLength(1);
  expect(
    (await read.history({ origin: 'music', limit: 10, search: '' })).rows[0]?.row,
  ).toMatchObject({ duration: 180, thumbnail: play.thumbnail, opened: 2 });
});
