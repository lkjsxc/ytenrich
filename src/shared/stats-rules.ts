import {
  type ChannelDelta,
  type ChannelStat,
  type DayDelta,
  type DayStat,
  dayKey,
  type Impression,
  type Surface,
  type VideoStat,
} from './types.ts';

export function isSuppressed(s: VideoStat, threshold: number): boolean {
  return !s.allowed && s.opened === 0 && s.dismissedAt === 0 && s.seen >= threshold;
}

export function emptyStat(id: string, now: number): VideoStat {
  return {
    id,
    kind: 'video',
    title: '',
    channel: '',
    firstSeen: now,
    lastSeen: now,
    seen: 0,
    opened: 0,
    openedAt: 0,
    dismissedAt: 0,
    allowed: false,
    surfaces: {},
  };
}

export function applyImpression(
  prev: VideoStat | undefined,
  item: Impression,
  now: number,
): VideoStat {
  const s = prev ?? emptyStat(item.id, now);
  return {
    ...s,
    kind: item.kind,
    title: item.title || s.title,
    channel: item.channel || s.channel,
    lastSeen: now,
    seen: s.seen + 1,
    surfaces: { ...s.surfaces, [item.surface]: (s.surfaces[item.surface] ?? 0) + 1 },
  };
}

export function emptyDay(day: string): DayStat {
  return {
    day,
    seen: 0,
    fresh: 0,
    opened: 0,
    picked: 0,
    dismissed: 0,
    hidden: 0,
    shorts: 0,
    surfaces: {},
    hours: new Array<number>(24).fill(0),
  };
}

/** Fills fields that rows written by older versions lack. */
export function normDay(raw: Partial<DayStat> & { day: string }): DayStat {
  const base = emptyDay(raw.day);
  return { ...base, ...raw, hours: raw.hours?.length === 24 ? raw.hours : base.hours };
}

/** Adds counters to a day. Impressions (`delta.seen`) also land in the local hour of `now`. */
export function addDay(prev: DayStat | undefined, now: number, delta: DayDelta): DayStat {
  const d = normDay(prev ?? { day: dayKey(now) });
  const surfaces = { ...d.surfaces };
  for (const [k, n] of Object.entries(delta.surfaces ?? {}) as [Surface, number][])
    surfaces[k] = (surfaces[k] ?? 0) + n;
  const hours = [...d.hours];
  const hour = new Date(now).getHours();
  hours[hour] = (hours[hour] ?? 0) + (delta.seen ?? 0);
  const add = (k: Exclude<keyof DayDelta, 'surfaces'>): number => d[k] + (delta[k] ?? 0);
  return {
    day: d.day,
    seen: add('seen'),
    fresh: add('fresh'),
    opened: add('opened'),
    picked: add('picked'),
    dismissed: add('dismissed'),
    hidden: add('hidden'),
    shorts: add('shorts'),
    surfaces,
    hours,
  };
}

export function addChannel(
  prev: ChannelStat | undefined,
  name: string,
  now: number,
  delta: ChannelDelta,
): ChannelStat {
  const c = prev ?? { name, seen: 0, videos: 0, opened: 0, dismissed: 0, lastSeen: now };
  return {
    name,
    seen: c.seen + (delta.seen ?? 0),
    videos: c.videos + (delta.videos ?? 0),
    opened: c.opened + (delta.opened ?? 0),
    dismissed: c.dismissed + (delta.dismissed ?? 0),
    lastSeen: delta.seen ? now : c.lastSeen,
  };
}

export const PRUNE_AGE_MS = 90 * 24 * 3600 * 1000;
export const MAX_VIDEOS = 100_000;

export function isPrunable(s: VideoStat, now: number): boolean {
  return s.opened === 0 && !s.allowed && s.dismissedAt === 0 && now - s.lastSeen > PRUNE_AGE_MS;
}
export const MAX_CHANNELS = 20_000;
