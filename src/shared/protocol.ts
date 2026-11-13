// Typed request/response protocol between content/options pages and the background (stats owner).
import type {
  ChannelSort,
  ChannelStat,
  Impression,
  Kind,
  Overview,
  RecoPage,
  RecoQuery,
  StatsPage,
  StatsQuery,
  StoreName,
} from './types.ts';

export type Api = {
  /** `hidden`: over-exposed recommendations hidden since the last call. */
  record: { req: { items: readonly Impression[]; hidden: number }; res: { suppressed: string[] } };
  /** Recommendations found on the page but not on screen. `want`: the stock is low, collect more. */
  offer: { req: { items: readonly Impression[] }; res: { want: boolean } };
  opened: { req: { id: string; kind: Kind; title: string; channel: string }; res: null };
  /** Fills a missing title (a video opened without ever being recommended). */
  describe: { req: { id: string; title: string }; res: null };
  dismissed: { req: { id: string }; res: null };
  suppressed: { req: null; res: string[] };
  query: { req: StatsQuery; res: StatsPage };
  recommend: { req: { query: RecoQuery; limit: number }; res: RecoPage };
  overview: { req: null; res: Overview };
  channels: { req: { sort: ChannelSort; limit: number }; res: ChannelStat[] };
  clear: { req: null; res: null };
  /** Backup: one page of a store's rows after primary key `after`; `next` is null at the end. */
  dump: {
    req: { store: StoreName; after: string | null; limit: number };
    res: { rows: unknown[]; next: string | null };
  };
  /** Backup: writes rows (repaired to the current shape) over any with the same key. */
  restore: { req: { store: StoreName; rows: readonly unknown[] }; res: null };
};
export type Method = keyof Api;
export type Message = { [K in Method]: { type: K; req: Api[K]['req'] } }[Method];
export type Reply<T> = { ok: T } | { error: string };

export async function call<K extends Method>(type: K, req: Api[K]['req']): Promise<Api[K]['res']> {
  const reply = (await chrome.runtime.sendMessage({ type, req })) as
    | Reply<Api[K]['res']>
    | undefined;
  if (!reply) throw new Error(`no reply for ${type}`);
  if ('error' in reply) throw new Error(reply.error);
  return reply.ok;
}

/** Bumped (throttled) by the background after any stats mutation; storage events reach every context. */
export const STATS_REV_KEY = 'statsRev';

export function onStatsChanged(fn: () => void): () => void {
  const listener = (changes: Record<string, chrome.storage.StorageChange>, area: string): void => {
    if (area === 'local' && changes[STATS_REV_KEY]) fn();
  };
  chrome.storage.onChanged.addListener(listener);
  return () => chrome.storage.onChanged.removeListener(listener);
}
