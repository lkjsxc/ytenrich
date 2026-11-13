// Settings in the manner of an editor's settings page: a search box over one grouped list. Every word typed must
// occur in an entry's group, title, description or key; `@modified` keeps the entries changed from their default.
import { h } from '../shared/h.ts';
import { SETTINGS_SCHEMA, type Settings } from '../shared/settings.ts';
import type { ViewEnv } from './registry.ts';
import { dataEntries } from './settings-data.ts';
import { type Entry, fieldEntry } from './settings-entry.ts';

const MODIFIED = '@modified';

export function mountSettings(el: HTMLElement, env: ViewEnv): () => void {
  const status = h('p', { class: 'muted' });
  const entries = [...SETTINGS_SCHEMA.map(fieldEntry), ...dataEntries(env, status)];
  const groups = [...new Set(entries.map((e) => e.group))].map((name) => ({
    name,
    head: h('h3', { class: 'sgroup' }, name),
    entries: entries.filter((e) => e.group === name),
  }));
  let changed = new Set<Entry>(); // bound: the entries of this view

  const filter = (): void => {
    const words = search.value.toLowerCase().split(/\s+/).filter(Boolean);
    let shown = 0;
    for (const e of entries) {
      const hit = words.every((w) => (w === MODIFIED ? changed.has(e) : e.text.includes(w)));
      e.node.hidden = !hit;
      if (hit) shown++;
    }
    for (const g of groups) g.head.hidden = g.entries.every((e) => e.node.hidden);
    count.textContent =
      shown === entries.length
        ? `${shown} settings`
        : shown
          ? `${shown} of ${entries.length} settings`
          : 'No settings found';
    modified.textContent = `${changed.size} modified`;
    modified.hidden = !changed.size;
  };
  const search = h('input', {
    type: 'search',
    placeholder: 'Search settings',
    'aria-label': 'Search settings',
    oninput: filter,
  });
  const count = h('span', { class: 'muted' });
  const modified = h('button', {
    title: 'Show only the settings changed from their default',
    onclick: () => {
      search.value = MODIFIED;
      filter();
    },
  });
  const sync = (s: Settings): void => {
    const focused = (el.getRootNode() as Document | ShadowRoot).activeElement;
    changed = new Set(entries.filter((e) => e.sync(s, focused)));
    filter();
  };

  el.replaceChildren(
    h('div', { class: 'ssearch' }, search, h('div', { class: 'scount' }, count, modified)),
    ...groups.flatMap((g) => [g.head, ...g.entries.map((e) => e.node)]),
    status,
  );
  sync(env.settings.get());
  return env.settings.subscribe(sync);
}
