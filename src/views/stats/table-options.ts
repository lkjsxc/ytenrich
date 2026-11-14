// Labels of the video table's filter chips, kind select and sortable columns.
import type { StatsFilter, StatsQuery, StatsSort } from '../../shared/types.ts';

export const FILTERS: readonly (readonly [StatsFilter, string])[] = [
  ['all', 'All'],
  ['pending', 'Still recommended'],
  ['suppressed', 'Over-exposed'],
  ['unopened', 'Never opened'],
  ['opened', 'Opened'],
  ['dismissed', 'Not interested'],
];
export const KINDS: readonly (readonly [StatsQuery['kind'], string])[] = [
  ['all', 'Everything'],
  ['video', 'Videos'],
  ['short', 'Shorts'],
  ['mix', 'Mix lists'],
];
export const COLUMNS: readonly (readonly [StatsSort, string])[] = [
  ['seen', 'Shown'],
  ['opened', 'Opened'],
  ['lastSeen', 'Last'],
];
