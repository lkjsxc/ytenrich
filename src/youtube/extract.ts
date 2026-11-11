import { parseAge } from '../shared/age.ts';
import type { Kind } from '../shared/types.ts';
import {
  AGE_TEXT,
  AVATAR,
  CHANNEL,
  ITEM_ROOT_INNER,
  ITEM_ROOT_OUTER,
  LIST_TILE,
  MENU_HOST,
  NOT_RECO,
  TITLE,
  VIDEO_ANCHOR,
} from './selectors.ts';

export type ItemInfo = {
  id: string;
  kind: Kind;
  title: string;
  channel: string;
  anchor: HTMLAnchorElement;
};

export function parseHref(href: string): { id: string; kind: Kind } | undefined {
  const shorts = /^\/shorts\/([\w-]{6,})/.exec(href);
  if (shorts?.[1]) return { id: shorts[1], kind: 'short' };
  const watch = /^\/watch\?(?:.*&)?v=([\w-]{6,})/.exec(href);
  return watch?.[1] ? { id: watch[1], kind: 'video' } : undefined;
}

export function anchorsIn(node: Element): Iterable<HTMLAnchorElement> {
  return node.matches(VIDEO_ANCHOR)
    ? [node as HTMLAnchorElement]
    : node.querySelectorAll<HTMLAnchorElement>(VIDEO_ANCHOR);
}

export function itemRootOf(anchor: Element): Element | null {
  if (anchor.closest(NOT_RECO)) return null;
  return anchor.closest(ITEM_ROOT_OUTER) ?? anchor.closest(ITEM_ROOT_INNER);
}

function firstText(root: Element, selectors: readonly string[]): string {
  for (const sel of selectors) {
    const el = root.querySelector(sel);
    const text = (el?.getAttribute('title') || el?.textContent || '').trim();
    if (text) return text.replace(/\s+/g, ' ').slice(0, 200);
  }
  return '';
}

export function extractItem(root: Element): ItemInfo | undefined {
  const anchor = root.querySelector<HTMLAnchorElement>(VIDEO_ANCHOR);
  const parsed = anchor && parseHref(anchor.getAttribute('href') ?? '');
  // A Mix or playlist tile links to its first video, but it is a list, not that video.
  if (!anchor || !parsed || root.matches(LIST_TILE)) return undefined;
  return { ...parsed, anchor, title: firstText(root, TITLE), channel: firstText(root, CHANNEL) };
}

export function menuHostOf(root: Element): Element | null {
  return root.querySelector(MENU_HOST);
}

/** The channel avatar's address, once the tile has loaded it (it is lazy, so read this late). */
export function avatarOf(root: Element): string {
  return root.querySelector<HTMLImageElement>(AVATAR)?.src ?? '';
}

/** The tile's upload-age text ('' when it shows none, as Shorts do). Rendered late, so read this late too. */
export function ageOf(root: Element): string {
  for (const el of root.querySelectorAll(AGE_TEXT)) {
    const text = (el.textContent ?? '').trim();
    if (text.length < 40 && parseAge(text)) return text;
  }
  return '';
}
