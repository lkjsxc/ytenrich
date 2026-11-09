// Typed request/response protocol between content/options pages and the background (stats owner).
import type { Impression, Kind, StatsQuery, Summary, VideoStat } from './types.ts';

export type Api = {
  record: { req: { items: readonly Impression[] }; res: { suppressed: string[] } };
  opened: { req: { id: string; kind: Kind; title: string; channel: string }; res: null };
  dismissed: { req: { id: string }; res: null };
  suppressed: { req: null; res: string[] };
  counts: { req: { ids: readonly string[] }; res: Record<string, number> };
  query: { req: StatsQuery; res: VideoStat[] };
  summary: { req: null; res: Summary };
  allow: { req: { id: string; allowed: boolean }; res: null };
  clear: { req: null; res: null };
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
