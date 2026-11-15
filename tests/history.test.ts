import { IDBFactory, IDBKeyRange } from 'fake-indexeddb';
import { beforeEach, expect, it, vi } from 'vitest';

beforeEach(() => {
  vi.resetModules();
  vi.stubGlobal('indexedDB', new IDBFactory());
  vi.stubGlobal('IDBKeyRange', IDBKeyRange);
});
const request = { id: 'video', kind: 'video' as const, title: 'Title', channel: 'Channel' };
const modules = async () => ({
  db: await import('../src/background/db.ts'),
  repo: await import('../src/background/stats-repo.ts'),
  read: await import('../src/background/history.ts'),
  backup: await import('../src/background/backup.ts'),
});

it('writes exactly one event for each counter increment, including equal timestamps', async () => {
  const { db, repo, read } = await modules();
  vi.spyOn(Date, 'now').mockReturnValue(1000);
  await repo.opened(request);
  await repo.describe(request.id, 'Description');
  await repo.dismissed(request.id);
  await repo.opened(request);
  const opens = await read.videoOpens(request.id);
  expect(opens).toHaveLength(2);
  expect(opens.map((e) => e.time)).toEqual([1000, 1000]);
  const row = await db.done(
    (await db.openDb()).transaction('videos').objectStore('videos').get(request.id),
  );
  expect([row.opened, row.openedAt]).toEqual([2, 1000]);
  vi.restoreAllMocks();
});

it('backfills one latest event per opened video when upgrading v3', async () => {
  await new Promise<void>((resolve) => {
    const req = indexedDB.open('ytenrich', 3);
    req.onupgradeneeded = () => {
      const videos = req.result.createObjectStore('videos', { keyPath: 'id' });
      req.result.createObjectStore('channels', { keyPath: 'name' });
      videos.put({ ...request, opened: 9, openedAt: 1234 });
      videos.put({ id: 'unopened', opened: 0, openedAt: 0 });
    };
    req.onsuccess = () => {
      req.result.close();
      resolve();
    };
  });
  const { read } = await modules();
  expect(await read.videoOpens(request.id)).toEqual([
    { id: 'legacy:video', video: 'video', time: 1234 },
  ]);
  expect(await read.videoOpens('unopened')).toEqual([]);
});

it('pages timestamp ties without gaps or duplicates and joins searchable video metadata', async () => {
  const { repo, read } = await modules();
  for (let n = 0; n < 7; n++) await repo.opened({ ...request, id: n % 2 ? 'other' : 'video' });
  const all = (await read.history({ search: '', limit: 100 })).rows;
  const ids: string[] = [];
  let before: [number, string] | undefined;
  do {
    const page = await read.history({ search: '', limit: 2, before });
    ids.push(...page.rows.map((e) => e.id));
    before = page.next ?? undefined;
  } while (before);
  expect(ids).toEqual(all.map((e) => e.id));
  expect(new Set(ids).size).toBe(7);
  expect((await read.history({ search: 'video', limit: 100 })).rows).toHaveLength(4);
  expect((await read.history({ search: 'CHANNEL', limit: 100 })).rows).toHaveLength(7);
});

it('removes events with pruned videos, clears them, and round-trips backups without orphans', async () => {
  const { db, repo, read, backup } = await modules();
  await repo.opened(request);
  const saved = await backup.dump('opens', null, 1);
  expect(saved.next).toBeTruthy();
  expect((await backup.dump('opens', saved.next, 1)).rows).toEqual([]);
  await repo.clear();
  expect(await read.videoOpens('video')).toEqual([]);
  await backup.restore('opens', saved.rows);
  expect(await read.videoOpens('video')).toEqual([]);
  await repo.opened(request);
  await backup.restore('opens', saved.rows);
  expect(await read.videoOpens('video')).toHaveLength(2);
  const tx = (await db.openDb()).transaction('videos', 'readwrite');
  const store = tx.objectStore('videos');
  const row = await db.done(store.get('video'));
  store.put({ ...row, opened: 0, lastSeen: 0 });
  await db.complete(tx);
  await repo.prune();
  expect(await read.videoOpens('video')).toEqual([]);
});

it('drops oldest events past the cap, leaving counters and latest time intact', async () => {
  const { db, repo, read } = await modules();
  await repo.opened(request);
  const tx = (await db.openDb()).transaction('opens', 'readwrite');
  const store = tx.objectStore('opens');
  store.clear();
  for (let i = 0; i <= 3; i++) store.put({ id: String(i), video: 'video', time: i });
  await read.capOpens(tx, 3);
  await db.complete(tx);
  expect(read.MAX_OPENS).toBe(200_000);
  const events = await read.videoOpens('video');
  expect(events).toHaveLength(3);
  expect(events.at(-1)?.time).toBe(1);
  expect(events[0]?.time).toBe(3);
  const video = await db.done(
    (await db.openDb()).transaction('videos').objectStore('videos').get('video'),
  );
  expect(video.opened).toBe(1);
  expect(video.openedAt).toBeGreaterThan(0);
}, 30_000);

it('rolls back both the event and counter when the open transaction fails', async () => {
  const { repo, read } = await modules();
  vi.spyOn(crypto, 'randomUUID').mockReturnValue('00000000-0000-4000-8000-000000000000');
  await repo.opened(request);
  await expect(repo.opened(request)).rejects.toBeTruthy();
  expect(await read.videoOpens('video')).toHaveLength(1);
  expect((await read.history({ search: '', limit: 10 })).rows[0]?.row.opened).toBe(1);
  vi.restoreAllMocks();
});
