// Stats reads for the Stats view. Everything is bounded: index walks stop at the page size.
import { normDay } from '../shared/stats-rules.ts';
import {
  type ChannelSort,
  type ChannelStat,
  type DayStat,
  OVERVIEW_DAYS,
  type Overview,
  type StatsPage,
  type StatsQuery,
  type VideoStat,
} from '../shared/types.ts';
import { CHANNELS, DAYS, done, openDb, VIDEOS, walk } from './db.ts';
import { type Judge, judge, suppressedIds } from './suppress.ts';

const FILTERS: Record<StatsQuery['filter'], (s: VideoStat, sup: Judge) => boolean> = {
  all: () => true,
  pending: (s, sup) => s.opened === 0 && s.dismissedAt === 0 && !sup(s),
  unopened: (s) => s.opened === 0,
  opened: (s) => s.opened > 0,
  suppressed: (s, sup) => sup(s),
  dismissed: (s) => s.dismissedAt > 0,
};

export async function query(q: StatsQuery, threshold: number): Promise<StatsPage> {
  const sup = await judge(threshold);
  const store = (await openDb()).transaction(VIDEOS).objectStore(VIDEOS);
  const needle = q.search.trim().toLowerCase();
  const match = (s: VideoStat): boolean =>
    (q.kind === 'all' || s.kind === q.kind) &&
    FILTERS[q.filter](s, sup) &&
    (!needle || `${s.title} ${s.channel} ${s.id}`.toLowerCase().includes(needle));
  let rows: VideoStat[] = [];
  if (q.channel) {
    // One channel's rows are few: read them through the channel index and sort in memory.
    const all = await done<VideoStat[]>(store.index('channel').getAll(q.channel));
    rows = all.filter(match).sort((a, b) => (b[q.sort] ?? 0) - (a[q.sort] ?? 0));
  } else {
    // Narrow the walk where the index allows: never-opened rows sort first by `openedAt`, and suppressed
    // rows all have seen ≥ threshold.
    const range =
      q.sort === 'openedAt'
        ? IDBKeyRange.lowerBound(1)
        : q.filter === 'suppressed' && q.sort === 'seen'
          ? IDBKeyRange.lowerBound(threshold)
          : null;
    await walk(store.index(q.sort), range, 'prev', (c) => {
      if (match(c.value as VideoStat)) rows.push(c.value as VideoStat);
      return rows.length <= q.limit;
    });
  }
  const page = rows.slice(0, q.limit);
  return { rows: page, more: rows.length > q.limit, suppressed: page.filter(sup).map((s) => s.id) };
}

export async function overview(threshold: number): Promise<Overview> {
  const tx = (await openDb()).transaction([VIDEOS, DAYS, CHANNELS]);
  const videos = done(tx.objectStore(VIDEOS).count());
  const channels = done(tx.objectStore(CHANNELS).count());
  const days: DayStat[] = [];
  await walk(
    tx.objectStore(DAYS),
    null,
    'prev',
    (c) => days.push(normDay(c.value as DayStat)) < OVERVIEW_DAYS,
  );
  return {
    videos: await videos,
    channels: await channels,
    suppressed: (await suppressedIds(threshold)).size,
    days,
  };
}

export async function channels(sort: ChannelSort, limit: number): Promise<ChannelStat[]> {
  const index = (await openDb()).transaction(CHANNELS).objectStore(CHANNELS).index(sort);
  const rows: ChannelStat[] = [];
  await walk(index, null, 'prev', (c) => rows.push(c.value as ChannelStat) < limit);
  return rows;
}
