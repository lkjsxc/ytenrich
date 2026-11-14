import { parseAge } from './age.ts';
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

const DAY_MS = 24 * 3600 * 1000;
export const LIKED_OPENS = 3; // opens that make a channel one the user likes
const LIKED_PATIENCE = 3; // a liked channel's video needs this many times the impressions
const REST_MS = 30 * DAY_MS; // not offered for this long: no longer pushed, so no longer over-exposed

/**
 * Over-exposed: YouTube keeps pushing a video this person keeps passing over. It takes `threshold` impressions
 * (three times as many for a channel they open), spread over more than a day (one long session is not
 * insistence), with the latest one recent. Opening or dismissing it settles the matter.
 */
export function isSuppressed(
  s: VideoStat,
  threshold: number,
  liked = false,
  now = Date.now(),
): boolean {
  if (s.opened || s.dismissedAt || s.seen < threshold * (liked ? LIKED_PATIENCE : 1)) return false;
  return s.lastSeen - s.firstSeen >= DAY_MS && now - s.lastSeen < REST_MS;
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
    offers: 0,
    published: 0,
    views: '',
    via: '',
    surfaces: {},
    video: '',
  };
}

/** The first estimate stays: later tiles word the age more coarsely ("1 year ago" covers 12 to 23 months). */
function publishedAt(s: VideoStat, item: Impression, now: number): number {
  const age = s.published ? 0 : parseAge(item.age ?? '');
  return age ? now - age : s.published;
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
    published: publishedAt(s, item, now),
    views: item.views || s.views || '',
    via: item.surface,
    seen: s.seen + 1,
    surfaces: { ...s.surfaces, [item.surface]: (s.surfaces[item.surface] ?? 0) + 1 },
    video: item.video || s.video || '',
  };
}

/** A recommendation YouTube put on a page that was not (yet) on screen: kept as a candidate, `seen` untouched. */
export function applyOffer(prev: VideoStat | undefined, item: Impression, now: number): VideoStat {
  const s = prev ?? emptyStat(item.id, now);
  return {
    ...s,
    kind: s.opened ? s.kind : item.kind,
    title: s.title || item.title, // what is known stays: a Mix tile carries the id of its first video
    channel: s.channel || item.channel,
    lastSeen: now,
    offers: s.offers + 1,
    published: publishedAt(s, item, now),
    views: item.views || s.views || '',
    via: item.surface,
    video: s.video || item.video || '',
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
  const c = prev ?? { name, seen: 0, videos: 0, opened: 0, dismissed: 0, lastSeen: now, icon: '' };
  return {
    name,
    seen: c.seen + (delta.seen ?? 0),
    videos: c.videos + (delta.videos ?? 0),
    opened: c.opened + (delta.opened ?? 0),
    dismissed: c.dismissed + (delta.dismissed ?? 0),
    lastSeen: delta.seen ? now : c.lastSeen,
    icon: c.icon ?? '',
  };
}

/** A view counter that builds before 0.2.9 stored as a channel name: "121K", "12万", "5.4M views", "541 watching". */
const COUNT_NAME =
  /^\d[\d.,]*\s?(\p{L}{1,3}\.?)?(\s(views?|watching|waiting|回視聴|人が視聴中|人が待機中))?$/u;
export const isCountName = (name: string): boolean => COUNT_NAME.test(name);

export const PRUNE_AGE_MS = 90 * 24 * 3600 * 1000;
export const MAX_VIDEOS = 100_000;

export function isPrunable(s: VideoStat, now: number): boolean {
  return s.opened === 0 && s.dismissedAt === 0 && now - s.lastSeen > PRUNE_AGE_MS;
}
export const MAX_CHANNELS = 20_000;

/** Avatars are only ever read from YouTube's own image hosts. */
export const isAvatarUrl = (url: string): boolean =>
  url.length < 400 && /^https:\/\/yt3\.(ggpht|googleusercontent)\.com\//.test(url);
