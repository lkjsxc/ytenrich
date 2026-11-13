// Incremental lists for own views: rows keep their DOM across refreshes, and the next page loads by itself.
import { h } from '../shared/h.ts';

/** Most rows a self-loading list grows to; past it the user narrows with search or filters. */
export const MAX_ROWS = 1000;

/** Next `limit` for a list that grows by `step`. */
export const grow = (limit: number, step: number): number => Math.min(MAX_ROWS, limit + step);

/**
 * Sentinel for the end of a list: asks for the next page while the end is still a few screens away (its
 * `.ahead` probe reaches that far up the list). A hidden tab never intersects, so background tabs load
 * nothing; each sentinel fires once and the repaint adds the next.
 */
export function autoMore(more: boolean, limit: number, load: () => void): HTMLElement | null {
  if (!more) return null;
  if (limit >= MAX_ROWS)
    return h(
      'p',
      { class: 'muted more' },
      `Showing the first ${MAX_ROWS}. Search or filter to narrow.`,
    );
  const probe = h('span', { class: 'ahead' });
  const el = h('div', { class: 'muted more' }, 'Loading more…', probe);
  const io = new IntersectionObserver((entries) => {
    if (!entries.some((e) => e.isIntersecting)) return;
    io.disconnect();
    load();
  });
  io.observe(probe);
  return el;
}

export type Keyed = readonly [key: string, make: () => HTMLElement];

/** Replaces `parent`'s children, reusing the nodes whose key is unchanged (loaded images stay loaded). */
export function keyed(parent: HTMLElement, items: readonly Keyed[]): void {
  const old = new Map<string, HTMLElement>(); // bound: the children of one list (≤ MAX_ROWS + headers)
  for (const c of parent.children) old.set((c as HTMLElement).dataset.key ?? '', c as HTMLElement);
  const same =
    items.length >= old.size &&
    [...parent.children].every((c, i) => old.get(items[i]?.[0] ?? '') === c);
  const nodes = items.slice(same ? old.size : 0).map(([key, make]) => {
    const el = old.get(key) ?? make();
    el.dataset.key = key;
    return el;
  });
  if (same) parent.append(...nodes);
  else parent.replaceChildren(...nodes);
}
