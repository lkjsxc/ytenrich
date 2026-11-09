// Shorts recommended on the current page, split out of the native list into their own grid.

import type { RecoItem } from '../content/scanner.ts';
import { h } from '../shared/h.ts';
import type { ViewEnv } from './registry.ts';

export function mountShorts(el: HTMLElement, env: ViewEnv): () => void {
  const scanner = env.scanner;
  if (!scanner) return () => undefined;
  const io = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        const item = e.isIntersecting ? tiles.get(e.target) : undefined;
        if (item) scanner.markSeen(item);
      }
    },
    { threshold: 0.5 },
  );
  let tiles = new WeakMap<Element, RecoItem>();
  const open = (item: RecoItem): void => {
    if (item.anchor.isConnected) item.anchor.click();
    else location.assign(`/shorts/${item.id}`);
  };
  const tile = (item: RecoItem): HTMLElement => {
    const t = h(
      'button',
      { class: 'short', title: item.title, onclick: () => open(item) },
      h('img', {
        src: `https://i.ytimg.com/vi/${item.id}/hqdefault.jpg`,
        loading: 'lazy',
        alt: '',
      }),
      h('span', null, item.title),
    );
    tiles.set(t, item);
    io.observe(t);
    return t;
  };
  const render = (): void => {
    io.disconnect();
    tiles = new WeakMap();
    const items = [...scanner.pageItems().values()].filter(
      (i) => i.kind === 'short' && !env.suppressed?.has(i.id),
    );
    el.replaceChildren(
      items.length
        ? h('div', { class: 'shorts' }, items.map(tile))
        : h('p', { class: 'muted' }, 'No Shorts recommended on this page.'),
    );
  };
  render();
  const off = scanner.version.subscribe(render);
  return () => {
    off();
    io.disconnect();
  };
}
