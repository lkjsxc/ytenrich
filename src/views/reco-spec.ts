// Settings of one Recommended tab (kept in its view state): what it lists, from which channel, in what order.
import type { Kind, RecoOrder, RecoQuery } from '../shared/types.ts';

/** `page`: the channel of the YouTube page on screen (a watch page's owner, a channel page). */
export type Scope = 'all' | 'page' | 'named';
export type RecoSpec = {
  readonly kinds: readonly Kind[];
  readonly scope: Scope;
  /** The channel's exact name, for `named`. */
  readonly channel: string;
  readonly group: boolean;
  readonly opened: boolean;
  readonly order: RecoOrder;
};

const BASE: RecoSpec = {
  kinds: ['video'],
  scope: 'all',
  channel: '',
  group: false,
  opened: false,
  order: 'ranked',
};
export const recoSpec = (patch: Partial<RecoSpec> = {}): RecoSpec => ({ ...BASE, ...patch });

export const KINDS: readonly (readonly [Kind, string])[] = [
  ['video', 'Videos'],
  ['short', 'Shorts'],
  ['mix', 'Mixes'],
];
export const SCOPES: readonly (readonly [Scope, string])[] = [
  ['all', 'Every channel'],
  ['page', 'This page’s channel'],
  ['named', 'One channel'],
];
export const ORDERS: readonly (readonly [RecoOrder, string])[] = [
  ['ranked', 'For you'],
  ['newest', 'Newest'],
];
const LABEL = Object.fromEntries(KINDS) as Record<Kind, string>;

const oneOf = <T>(value: unknown, options: readonly (readonly [T, string])[], or: T): T =>
  options.some(([o]) => o === value) ? (value as T) : or;

/** A stored spec, with anything unusable taken from `or` (the tab's default). */
export function parseSpec(value: unknown, or: RecoSpec): RecoSpec {
  if (typeof value !== 'object' || value === null) return or;
  const raw = value as Record<string, unknown>;
  const listed = Array.isArray(raw.kinds) ? (raw.kinds as unknown[]) : [];
  const kinds = KINDS.map(([k]) => k).filter((k) => listed.includes(k));
  return {
    kinds: kinds.length ? kinds : or.kinds,
    scope: oneOf(raw.scope, SCOPES, or.scope),
    channel: typeof raw.channel === 'string' ? raw.channel.slice(0, 200) : or.channel,
    group: typeof raw.group === 'boolean' ? raw.group : or.group,
    opened: typeof raw.opened === 'boolean' ? raw.opened : or.opened,
    order: oneOf(raw.order, ORDERS, or.order),
  };
}

/** A tab is named after what it lists: "Videos", "Shorts + Mixes", "Channels", "This channel", "Lofi Girl". */
export function specTitle(s: RecoSpec): string {
  if (s.scope === 'page') return 'This channel';
  if (s.scope === 'named' && s.channel.trim()) return s.channel.trim();
  if (s.group) return 'Channels';
  return s.kinds.map((k) => LABEL[k]).join(' + ');
}

/** The background's query, or `null` when the channel it needs is unknown (no page channel, no name typed). */
export function toQuery(s: RecoSpec, pageChannel: string): RecoQuery | null {
  const channel = s.scope === 'page' ? pageChannel : s.scope === 'named' ? s.channel.trim() : '';
  if (s.scope !== 'all' && !channel) return null;
  const { kinds, group, opened, order } = s;
  return { kinds, channel, group, opened, order };
}
