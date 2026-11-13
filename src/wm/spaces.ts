// Workspaces: a layout family holds several layouts and shows one, like virtual desktops. Which one shows is
// this tab's own choice (remembered for the next page); how many there are is shared by every tab.
import { layoutKey, spacesKey } from '../shared/layout-store.ts';
import type { WmFamily } from '../shared/types.ts';
import type { MenuItem } from './menus.ts';
import { DEFAULT_SPACES, presetOf } from './presets.ts';

export const MAX_SPACES = 9;
export type Spaces = { readonly active: number; readonly count: number };
/** The workspace a controller shows, and the pane-menu entries that act on it. */
export type Space = { readonly index: number; readonly menu: readonly MenuItem[] };

export function parseSpaces(value: unknown, family: WmFamily): Spaces {
  const raw = (typeof value === 'object' && value !== null ? value : {}) as Record<string, unknown>;
  const int = (v: unknown, fallback: number): number =>
    typeof v === 'number' && Number.isInteger(v) ? Math.min(MAX_SPACES, Math.max(1, v)) : fallback;
  const count = int(raw.count, DEFAULT_SPACES[family]);
  return { count, active: Math.min(count, int(raw.active, 1)) };
}

/** Another tab changed the workspaces: take its count, keep showing ours. */
export const mergeSpaces = (mine: Spaces, theirs: Spaces): Spaces => ({
  count: theirs.count,
  active: Math.min(mine.active, theirs.count),
});

export const saveSpaces = (family: WmFamily, s: Spaces): Promise<void> =>
  chrome.storage.local.set({ [spacesKey(family)]: s });

/** A new last workspace that starts as a copy of the one showing; returns the state that shows it. */
export async function addSpace(family: WmFamily, s: Spaces): Promise<Spaces> {
  if (s.count >= MAX_SPACES) return s;
  const from = layoutKey(family, s.active);
  const next = { active: s.count + 1, count: s.count + 1 };
  const layout = (await chrome.storage.local.get(from))[from] ?? presetOf(family, s.active);
  await chrome.storage.local.set({
    [layoutKey(family, next.active)]: layout,
    [spacesKey(family)]: next,
  });
  return next;
}

/** Drops the workspace showing; the later ones move down a number. */
export async function removeSpace(family: WmFamily, s: Spaces): Promise<Spaces> {
  if (s.count < 2) return s;
  const key = (n: number): string => layoutKey(family, n);
  const later = Array.from({ length: s.count - s.active }, (_, i) => s.active + 1 + i);
  const stored = await chrome.storage.local.get(later.map(key));
  const next = { count: s.count - 1, active: Math.min(s.active, s.count - 1) };
  await chrome.storage.local.set({
    ...Object.fromEntries(later.map((n) => [key(n - 1), stored[key(n)] ?? presetOf(family, n)])),
    [spacesKey(family)]: next,
  });
  await chrome.storage.local.remove(key(s.count));
  return next;
}
