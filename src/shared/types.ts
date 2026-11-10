export type Kind = 'video' | 'short';
export type Surface = 'home' | 'watch' | 'search' | 'channel' | 'subs' | 'shorts' | 'other';
export type PageKind = Surface;
/** Tiling layout family: watch pages, or every other page (projected whole as the `page` view). */
export type WmFamily = 'watch' | 'browse';

export type Impression = {
  readonly id: string;
  readonly kind: Kind;
  readonly surface: Surface;
  readonly title: string;
  readonly channel: string;
};

export type VideoStat = {
  id: string;
  kind: Kind;
  title: string;
  channel: string;
  firstSeen: number;
  lastSeen: number;
  seen: number;
  opened: number;
  /** Time of the latest open (0 = never). */
  openedAt: number;
  dismissedAt: number;
  allowed: boolean;
  surfaces: Partial<Record<Surface, number>>;
};

/** One local calendar day. `hours` holds 24 impression counts by local hour. */
export type DayStat = {
  day: string;
  seen: number;
  /** Impressions of videos never shown before. `seen - fresh` are repeats. */
  fresh: number;
  opened: number;
  /** Opens of videos that had been shown as a recommendation before. */
  picked: number;
  dismissed: number;
  /** Over-exposed recommendations hidden by ytenrich (once per navigation and video). */
  hidden: number;
  shorts: number;
  surfaces: Partial<Record<Surface, number>>;
  hours: number[];
};
export type DayDelta = Partial<Omit<DayStat, 'day' | 'hours'>>;

/** Cumulative per-channel counters, keyed by display name (the DOM exposes no stable channel id). */
export type ChannelStat = {
  name: string;
  seen: number;
  videos: number;
  opened: number;
  dismissed: number;
  lastSeen: number;
};
export type ChannelDelta = Partial<Omit<ChannelStat, 'name' | 'lastSeen'>>;
export type ChannelSort = 'seen' | 'opened';

export type StatsFilter = 'all' | 'unopened' | 'suppressed' | 'dismissed' | 'opened' | 'allowed';
export type StatsSort = 'seen' | 'opened' | 'lastSeen' | 'openedAt';
export type StatsQuery = {
  sort: StatsSort;
  filter: StatsFilter;
  kind: Kind | 'all';
  /** Exact channel name, or '' for every channel. */
  channel: string;
  limit: number;
  search: string;
};
export type StatsPage = { rows: VideoStat[]; more: boolean };
/** `days` is newest first and sparse (days without activity are absent), at most OVERVIEW_DAYS long. */
export type Overview = { videos: number; channels: number; suppressed: number; days: DayStat[] };
export const OVERVIEW_DAYS = 180;

export function dayKey(time: number): string {
  const d = new Date(time);
  const pad = (n: number): string => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
