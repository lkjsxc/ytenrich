// Standalone host for ytenrich views (toolbar button opens this page).

import { h } from '../../shared/h.ts';
import { createLog } from '../../shared/log.ts';
import { call } from '../../shared/protocol.ts';
import {
  DEFAULT_SETTINGS,
  loadSettings,
  onSettings,
  type Settings,
} from '../../shared/settings.ts';
import { createSignal, type Disposer } from '../../shared/signal.ts';
import css from '../../ui/ui.css';
import { VIEWS, type ViewEnv } from '../../views/registry.ts';
import { welcome } from './welcome.ts';

const settings = createSignal<Settings>(DEFAULT_SETTINGS);
void loadSettings().then(settings.set);
onSettings(settings.set);
const env: ViewEnv = { call, log: createLog(), settings };
const tabs = VIEWS.filter((v) => v.mount);
const nav = h('nav');
const main = h('div', { class: 'view' });
let dispose: Disposer = () => undefined;

const show = (id: string): void => {
  dispose();
  const def = tabs.find((t) => t.id === id) ?? tabs[0];
  if (!def?.mount) return;
  main.replaceChildren();
  dispose = def.mount(main, env);
  for (const b of nav.children)
    b.classList.toggle('active', (b as HTMLElement).dataset.id === def.id);
  history.replaceState(null, '', `#${def.id}`);
};
nav.append(
  ...tabs.map((t) => h('button', { 'data-id': t.id, onclick: () => show(t.id) }, t.title)),
);
document.head.append(h('style', null, css));
const first = location.hash === '#welcome';
const intro = first ? [welcome(settings)] : [];
// The welcome page waits for stored settings so an earlier "yes" is not offered again.
void loadSettings().then(() => {
  document.body.append(h('div', { class: 'page' }, ...intro, nav, main));
  show(first ? 'settings' : location.hash.slice(1) || 'stats');
});
