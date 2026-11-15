import { IDBFactory, IDBKeyRange } from 'fake-indexeddb';
import { afterEach, expect, it, vi } from 'vitest';
import { exportData, importData } from '../src/shared/backup.ts';
import type { call as Call } from '../src/shared/protocol.ts';

afterEach(() => {
  vi.unstubAllGlobals();
});

it('exports/imports every event and backfills old exports only once per opened video', async () => {
  vi.resetModules();
  vi.stubGlobal('indexedDB', new IDBFactory());
  vi.stubGlobal('IDBKeyRange', IDBKeyRange);
  vi.stubGlobal('chrome', {
    storage: {
      local: {
        get: async () => ({}),
        set: async () => {},
        remove: async () => {},
      },
    },
  });
  const repo = await import('../src/background/stats-repo.ts');
  const backup = await import('../src/background/backup.ts');
  const read = await import('../src/background/history.ts');
  const call = (async (method: string, req: Record<string, unknown>) => {
    if (method === 'clear') return repo.clear();
    if (method === 'dump')
      return backup.dump(req.store as 'opens', req.after as string | null, req.limit as number);
    if (method === 'restore') return backup.restore(req.store as 'opens', req.rows as unknown[]);
    throw new Error(method);
  }) as typeof Call;
  const video = { id: 'video', kind: 'video' as const, title: 'Title', channel: 'Channel' };
  await repo.opened(video);
  await repo.opened(video);
  const data = await exportData(call);
  expect(data.stats.opens).toHaveLength(2);
  await importData(call, data);
  expect(await read.videoOpens(video.id)).toEqual(
    [...data.stats.opens].sort((a, b) => {
      const x = a as { time: number; id: string },
        y = b as { time: number; id: string };
      return y.time - x.time || (x.id < y.id ? 1 : -1);
    }),
  );
  const legacy = {
    ...data,
    stats: { videos: data.stats.videos, days: data.stats.days, channels: data.stats.channels },
  };
  await importData(call, legacy);
  const events = await read.videoOpens(video.id);
  expect(events).toHaveLength(1);
  expect(events[0]?.time).toBe((data.stats.videos[0] as { openedAt: number }).openedAt);
  expect((await read.history({ search: '', limit: 1 })).rows[0]?.row.opened).toBe(2);
});
