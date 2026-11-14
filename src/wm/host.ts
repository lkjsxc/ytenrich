// Shadow-root host for all ytenrich UI on youtube.com and YouTube Music. Lives outside the YouTube app root so YouTube never re-renders it.
// Must be a child of <body>, not <html>: YouTube's scroll lock (guide drawer, dialogs) makes body position:fixed,
// i.e. a stacking context, and a host outside it would paint above every YouTube overlay.

import { h } from '../shared/h.ts';
import type { Settings } from '../shared/settings.ts';
import css from '../ui/ui.css';

export type Host = {
  readonly root: HTMLElement;
  readonly layer: HTMLElement;
  /** Leaves the site's own bars uncovered: the masthead above, YouTube Music's player bar below. */
  inset(by: { top: number; bottom: number }): void;
  /** Applies the UI scale, the tab bar scale and the fixed tab width. */
  look(s: Pick<Settings, 'uiScale' | 'tabScale' | 'tabWidth'>): void;
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
  // YouTube's hotkeys see our host as the event target, not the field inside it: keep typing to ourselves.
  for (const type of ['keydown', 'keypress', 'keyup'] as const)
    shadow.addEventListener(type, (e) => {
      if ((e.target as Element).matches('input, textarea, select')) e.stopPropagation();
    });
  const html = document.documentElement;
  const theme = (): void =>
    host.setAttribute('theme', html.hasAttribute('dark') ? 'dark' : 'light');
  const mo = new MutationObserver(theme);
  mo.observe(html, { attributes: true, attributeFilter: ['dark'] });
  theme();
  const mount = (): void => void (document.body ?? html).appendChild(host);
  mount();
  if (!document.body) document.addEventListener('DOMContentLoaded', mount, { once: true });
  return {
    root,
    layer,
    inset({ top, bottom }) {
      host.style.top = `${top}px`;
      host.style.bottom = `${bottom}px`;
    },
    look(s) {
      host.style.setProperty('--scale', String(s.uiScale));
      host.style.setProperty('--tab-scale', String(s.tabScale));
      host.style.setProperty('--tab-w', s.tabWidth ? `${s.tabWidth}px` : 'auto');
    },
    dispose() {
      mo.disconnect();
      document.removeEventListener('DOMContentLoaded', mount);
      host.remove();
    },
  };
}
