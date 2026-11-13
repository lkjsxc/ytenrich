import type { PageKind } from '../shared/types.ts';

export function pageKind(url: URL): PageKind {
  const p = url.pathname;
  if (p === '/') return 'home';
  if (p === '/watch' || p.startsWith('/live/')) return 'watch';
  if (p === '/results') return 'search';
  if (p.startsWith('/shorts/')) return 'shorts';
  if (p.startsWith('/feed/subscriptions')) return 'subs';
  if (/^\/(@|channel\/|c\/|user\/)/.test(p)) return 'channel';
  return 'other';
}

/** Video id of the page itself (watch, live or shorts), if any. */
export function pageVideoId(url: URL): string | undefined {
  if (url.pathname === '/watch') return url.searchParams.get('v') ?? undefined;
  return /^\/(?:shorts|live)\/([\w-]{6,})/.exec(url.pathname)?.[1];
}

/** The Mix a watch page plays (`list=RD…`), if any. */
export function pageMixId(url: URL): string | undefined {
  const list = url.pathname === '/watch' ? url.searchParams.get('list') : null;
  return list?.startsWith('RD') ? list : undefined;
}

export const watchUrl = (id: string): string => `https://www.youtube.com/watch?v=${id}`;

/** Fired by YouTube's SPA router after every in-app navigation. */
export const NAV_EVENT = 'yt-navigate-finish';
