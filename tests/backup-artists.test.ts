import { IDBFactory, IDBKeyRange } from 'fake-indexeddb';
import { beforeEach, expect, it, vi } from 'vitest';
import { emptyStat } from '../src/shared/stats-rules.ts';

beforeEach(() => {
  vi.resetModules();
  vi.stubGlobal('indexedDB', new IDBFactory());
  vi.stubGlobal('IDBKeyRange', IDBKeyRange);
});

it.each(['311', '10cc'])(
  'preserves %s artist metadata and totals through a Music backup round trip',
  async (channel) => {
    const { played } = await import('../src/background/music-repo.ts');
    const { clear } = await import('../src/background/stats-repo.ts');
    const { dump, restore } = await import('../src/background/backup.ts');
    const { STORES } = await import('../src/background/origin.ts');
    const play = {
      id: 'track',
      title: 'Song',
      channel,
      thumbnail: '',
      duration: 180,
      time: Date.now(),
    };
    await played(play);
    await played({ ...play, time: play.time + 1000 });
    const saved = await Promise.all(STORES.map((store) => dump(store, null, 100)));
    expect(saved[STORES.indexOf('music-channels')]?.rows).toMatchObject([
      { name: channel, opened: 2, videos: 1 },
    ]);
    await clear();
    for (const [i, store] of STORES.entries()) await restore(store, saved[i]!.rows);
    const restored = await Promise.all(STORES.map((store) => dump(store, null, 100)));
    expect(restored).toEqual(saved);
  },
);

it.each(['121K', '5.4M views'])(
  'still removes legacy YouTube view-counter channel %s on restore',
  async (channel) => {
    const { dump, restore } = await import('../src/background/backup.ts');
    await restore('videos', [{ ...emptyStat('video', Date.now()), channel, opened: 1 }]);
    await restore('channels', [{ name: channel, opened: 1, videos: 1 }]);
    expect((await dump('videos', null, 100)).rows).toMatchObject([{ id: 'video', channel: '' }]);
    expect((await dump('channels', null, 100)).rows).toEqual([]);
  },
);
