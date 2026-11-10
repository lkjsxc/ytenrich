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
  dismissedAt: number;
  allowed: boolean;
  surfaces: Partial<Record<Surface, number>>;
};

export type DayStat = { day: string; seen: number; opened: number; dismissed: number };

export type StatsFilter = 'all' | 'unopened' | 'suppressed' | 'dismissed' | 'opened';
export type StatsSort = 'seen' | 'lastSeen';
export type StatsQuery = { sort: StatsSort; filter: StatsFilter; limit: number; search: string };
export type Summary = { videos: number; suppressed: number; days: DayStat[] };

export function dayKey(time: number): string {
  const d = new Date(time);
  const pad = (n: number): string => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
