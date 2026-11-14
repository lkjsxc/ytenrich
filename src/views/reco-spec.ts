// Settings of one Recommended tab (kept in its view state): what it lists, from which channel, in what order.
import type { Kind, RecoOrder, RecoQuery } from '../shared/types.ts';

/** `page`: the channel of the YouTube page on screen (a watch page's owner, a channel page). */
export type Scope = 'all' | 'page';
export type RecoSpec = {
  readonly kind: Kind;
  readonly scope: Scope;
  readonly group: boolean;
  readonly opened: boolean;
  readonly order: RecoOrder;
};

const BASE: RecoSpec = {
  kind: 'video',
  scope: 'all',
  group: false,
  opened: false,
  order: 'ranked',
};
export const recoSpec = (patch: Partial<RecoSpec> = {}): RecoSpec => ({ ...BASE, ...patch });

export const KINDS: readonly (readonly [Kind, string])[] = [
  ['video', 'Videos'],
  ['short', 'Shorts'],
  ['mix', 'Mix lists'],
];
export const SCOPES: readonly (readonly [Scope, string])[] = [
  ['all', 'All channels'],
  ['page', 'This channel'],
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
  return {
    kind: oneOf(raw.kind, KINDS, or.kind),
    scope: oneOf(raw.scope, SCOPES, or.scope),
    group: typeof raw.group === 'boolean' ? raw.group : or.group,
    opened: typeof raw.opened === 'boolean' ? raw.opened : or.opened,
    order: oneOf(raw.order, ORDERS, or.order),
  };
}

/** A tab is named after what it lists: "Videos", "Mix lists", "Channels", "This channel", "This channel · Shorts". */
export function specTitle(s: RecoSpec): string {
  const kind = LABEL[s.kind];
  if (s.scope === 'page') return s.kind === 'video' ? 'This channel' : `This channel · ${kind}`;
  return s.group ? 'Channels' : kind;
}

/** The background's query, or `null` while the page shows no channel for a "This channel" tab. */
export function toQuery(s: RecoSpec, pageChannel: string, text = ''): RecoQuery | null {
  const channel = s.scope === 'page' ? pageChannel : '';
  if (s.scope === 'page' && !channel) return null;
  const { group, opened, order } = s;
  return { kinds: [s.kind], channel, group, opened, order, text: text.trim() };
}
