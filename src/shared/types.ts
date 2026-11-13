/** `mix`: a Mix tile (YouTube's endless radio list), keyed by its list id; `video` names the video it opens with. */
export type Kind = 'video' | 'short' | 'mix';
export type Surface = 'home' | 'watch' | 'search' | 'channel' | 'subs' | 'shorts' | 'other';
export type PageKind = Surface;
/** Tiling layout family: watch pages, home, channel pages, the Shorts player, or every other page (the page
 * itself is projected whole as the `page` view outside watch pages). Each family keeps its own saved layouts. */
export type WmFamily = 'watch' | 'browse' | 'home' | 'channel' | 'shorts';

export type Impression = {
  readonly id: string;
  readonly kind: Kind;
  readonly surface: Surface;
  readonly title: string;
  readonly channel: string;
  /** Upload age as the tile words it ("3 months ago"), when it shows one. */
  readonly age?: string;
  /** Address of the channel's avatar image, when the tile shows one. */
  readonly icon?: string;
  /** Mixes: the video the list opens with. */
  readonly video?: string;
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
  /** Page views on which YouTube put it on the page, on screen or not (0 in rows from before the collector). */
  offers: number;
  /** Estimated upload time, from the age a tile showed (0 = unknown). */
  published: number;
  /** Kind of page that last offered or showed it. */
  via: Surface | '';
  surfaces: Partial<Record<Surface, number>>;
  /** Mixes: the video the list opens with ('' otherwise; absent in rows from before mixes). */
  video: string;
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
  /** Avatar image address ('' when no tile showed one yet). */
  icon: string;
};
export type ChannelDelta = Partial<Omit<ChannelStat, 'name' | 'lastSeen' | 'icon'>>;
/** Stats stores a backup carries, each paged by its primary key. */
export type StoreName = 'videos' | 'days' | 'channels';
export type ChannelSort = 'seen' | 'opened';

/** `pending`: recommended but never opened, dismissed or over-exposed (the Recommended view). */
export type StatsFilter = 'pending' | 'all' | 'unopened' | 'suppressed' | 'dismissed' | 'opened';
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
/** `suppressed`: ids among `rows` that count as over-exposed right now. */
export type StatsPage = { rows: VideoStat[]; more: boolean; suppressed: string[] };
/** `ranked`: by the user's own record (`shared/recommend.ts`); `newest`: by upload time. */
export type RecoOrder = 'ranked' | 'newest';
/** What one Recommended tab asks for (its settings, `views/reco-spec.ts`, with the channel resolved).
 * `channel`: exact name, '' for every channel. `group`: under channel headings. `opened`: also opened ones. */
export type RecoQuery = {
  readonly kinds: readonly Kind[];
  readonly channel: string;
  readonly group: boolean;
  readonly opened: boolean;
  readonly order: RecoOrder;
};
/** `channels`: stats of the channels in `rows` (grouped queries only). */
export type RecoPage = StatsPage & { channels: ChannelStat[] };
/** `days` is newest first and sparse (days without activity are absent), at most OVERVIEW_DAYS long (in effect all). */
export type Overview = { videos: number; channels: number; suppressed: number; days: DayStat[] };
export const OVERVIEW_DAYS = 3660;

export function dayKey(time: number): string {
  const d = new Date(time);
  const pad = (n: number): string => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
