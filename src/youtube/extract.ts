import { parseAge } from '../shared/age.ts';
import type { Kind } from '../shared/types.ts';
import {
  AGE_TEXT,
  AVATAR,
  CHANNEL_CLASSIC,
  CHANNEL_PAGE,
  CHANNEL_PAGE_NAME,
  CHANNEL_TAB_TILE,
  ITEM_ROOT_INNER,
  ITEM_ROOT_OUTER,
  LIST_TILE,
  MENU_HOST,
  META_COUNT_ICON,
  META_ROW,
  META_TEXT,
  NOT_RECO,
  SHORTS_ANCHOR,
  SHOWN_CHANNEL_NAME,
  TITLE,
  VIDEO_ANCHOR,
  WATCH_OWNER_NAME,
} from './selectors.ts';

export type ItemInfo = {
  id: string;
  kind: Kind;
  title: string;
  channel: string;
  anchor: HTMLAnchorElement;
  /** Mixes: the video the list opens with. */
  video?: string;
};

export function parseHref(href: string): { id: string; kind: Kind } | undefined {
  const shorts = /^\/shorts\/([\w-]{6,})/.exec(href);
  if (shorts?.[1]) return { id: shorts[1], kind: 'short' };
  const watch = /^\/watch\?(?:.*&)?v=([\w-]{6,})/.exec(href);
  return watch?.[1] ? { id: watch[1], kind: 'video' } : undefined;
}

/** The list id of a Mix link (`/watch?v=…&list=RD…`); other playlists are not items. */
export const mixOf = (href: string): string | undefined => /[?&]list=(RD[\w-]+)/.exec(href)?.[1];

export function anchorsIn(node: Element): Iterable<HTMLAnchorElement> {
  return node.matches(VIDEO_ANCHOR)
    ? [node as HTMLAnchorElement]
    : node.querySelectorAll<HTMLAnchorElement>(VIDEO_ANCHOR);
}

export function itemRootOf(anchor: Element): Element | null {
  if (anchor.closest(NOT_RECO)) return null;
  return anchor.closest(ITEM_ROOT_OUTER) ?? anchor.closest(ITEM_ROOT_INNER);
}

function clean(el: Element | null | undefined): string {
  const text = (el?.getAttribute('title') || el?.textContent || '').trim();
  return text.replace(/\s+/g, ' ').slice(0, 200);
}

function firstText(root: Element, selectors: readonly string[]): string {
  for (const sel of selectors) {
    const text = clean(root.querySelector(sel));
    if (text) return text;
  }
  return '';
}

/**
 * The tile's channel name. A lockup names it in its first text row, above the counter row. On a channel's own
 * tabs the counter row is the only one, so a lone row or one that opens with the counter icon is never a name:
 * such a tile belongs to the channel in the page header. The header can render after the tile, so a tile
 * found without a channel is asked again when it is recorded.
 */
export function channelOf(root: Element): string {
  if (root.matches(LIST_TILE)) return ''; // its channel line names several channels
  const classic = clean(root.querySelector(CHANNEL_CLASSIC));
  if (classic) return classic;
  const rows = root.querySelectorAll(META_ROW);
  const first = rows[0];
  if (first && rows.length > 1 && !first.querySelector(META_COUNT_ICON))
    return clean(first.querySelector(META_TEXT));
  if (!root.matches(CHANNEL_TAB_TILE)) return '';
  return clean(root.closest(CHANNEL_PAGE)?.querySelector(CHANNEL_PAGE_NAME));
}

export function extractItem(root: Element): ItemInfo | undefined {
  const anchor = root.querySelector<HTMLAnchorElement>(VIDEO_ANCHOR);
  const parsed = anchor && parseHref(anchor.getAttribute('href') ?? '');
  if (!anchor || !parsed) return undefined;
  const title = firstText(root, TITLE);
  if (!root.matches(LIST_TILE)) return { ...parsed, anchor, title, channel: channelOf(root) };
  // A Mix or playlist tile links to its first video, but it is a list, not that video: a Mix is an item of its
  // own under its list id, a playlist is none.
  const list = mixOf(anchor.getAttribute('href') ?? '');
  return list ? { id: list, kind: 'mix', video: parsed.id, anchor, title, channel: '' } : undefined;
}

/** The channel the current page is about ('' on pages about none, or before it has rendered). */
export function pageChannel(kind: string): string {
  const sel = kind === 'watch' ? WATCH_OWNER_NAME : kind === 'channel' ? SHOWN_CHANNEL_NAME : '';
  return sel ? clean(document.querySelector(sel)) : '';
}

/** The Short a click lands on, if it is a plain link to one. */
export function shortsLinkOf(target: EventTarget | null): string | undefined {
  const a = (target as Element | null)?.closest?.(SHORTS_ANCHOR);
  const parsed = parseHref(a?.getAttribute('href') ?? '');
  return parsed?.kind === 'short' ? parsed.id : undefined;
}

export function menuHostOf(root: Element): Element | null {
  return root.querySelector(MENU_HOST);
}

/** The channel avatar's address, once the tile has loaded it (it is lazy, so read this late). */
export function avatarOf(root: Element): string {
  return root.querySelector<HTMLImageElement>(AVATAR)?.src ?? '';
}

const VIEWS = /views?|watching|視聴/i;
const COUNT = /^\d[\d.,]*\s?[KMB万億千]?$/i; // tiles now word a view count bare: "135K", "31M", "1,234"
/** The tile's view-count text, e.g. "135K views" ('' when it shows none). Rendered late, like the age. */
export function viewsOf(root: Element): string {
  for (const el of root.querySelectorAll(AGE_TEXT)) {
    const text = (el.textContent ?? '').trim();
    if (text.length > 40 || !/\d/.test(text) || parseAge(text)) continue;
    if (COUNT.test(text)) return `${text} views`;
    if (VIEWS.test(text)) return text;
  }
  return '';
}

/** The tile's upload-age text ('' when it shows none, as Shorts do). Rendered late, so read this late too. */
export function ageOf(root: Element): string {
  for (const el of root.querySelectorAll(AGE_TEXT)) {
    const text = (el.textContent ?? '').trim();
    if (text.length < 40 && parseAge(text)) return text;
  }
  return '';
}
