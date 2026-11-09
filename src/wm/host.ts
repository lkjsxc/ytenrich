// Shadow-root host for all ytenrich UI on youtube.com. Lives outside the YouTube app root so YouTube never re-renders it.

import { h } from '../shared/h.ts';
import css from '../ui/ui.css';

export type Host = {
  readonly root: HTMLElement;
  readonly layer: HTMLElement;
  setTop(px: number): void;
  dispose(): void;
};

export function createHost(): Host {
  const host = document.createElement('ytenrich-root');
  host.style.cssText =
    'position:fixed;left:0;right:0;bottom:0;top:56px;z-index:2;display:block;pointer-events:none;contain:strict';
  const shadow = host.attachShadow({ mode: 'open' });
  const root = h('div', { class: 'wm' });
  const layer = h('div', { class: 'layer' });
  shadow.append(h('style', null, css), root, layer);
  const html = document.documentElement;
  const theme = (): void =>
    host.setAttribute('theme', html.hasAttribute('dark') ? 'dark' : 'light');
  const mo = new MutationObserver(theme);
  mo.observe(html, { attributes: true, attributeFilter: ['dark'] });
  theme();
  html.appendChild(host);
  return {
    root,
    layer,
    setTop: (px) => void (host.style.top = `${px}px`),
    dispose() {
      mo.disconnect();
      host.remove();
    },
  };
}
