// New tab page: `+` opens it as a tab, and picking a card turns that tab into the chosen view.
import { h, replaceChildren } from '../shared/h.ts';

export const NEW_TAB = 'new';
export type Choice = {
  readonly kind: string;
  readonly title: string;
  readonly hint: string;
  /** Native YouTube part: exists once, so picking it while open elsewhere moves it here. */
  readonly native: boolean;
  readonly open: boolean;
};
export type LauncherApi = {
  choices(): readonly Choice[];
  pick(kind: string): void;
  close(): void;
};
export type Launcher = { update(): void; focus(): void; dispose(): void };

export function mountLauncher(el: HTMLElement, api: LauncherApi): Launcher {
  const list = h('div');
  const shown = (): Choice[] => {
    const words = filter.value.toLowerCase().split(/\s+/).filter(Boolean);
    return api
      .choices()
      .filter((c) => words.every((w) => `${c.title} ${c.hint}`.toLowerCase().includes(w)));
  };
  const card = (c: Choice, first: boolean): HTMLElement =>
    h(
      'button',
      { class: first ? 'ncard first' : 'ncard', onclick: () => api.pick(c.kind) },
      h('b', null, c.title),
      h('span', { class: 'muted' }, c.hint),
      c.native && c.open ? h('span', { class: 'badge' }, 'open elsewhere · moves here') : null,
      !c.native && c.open ? h('span', { class: 'badge' }, 'opens another') : null,
    );
  const update = (): void => {
    const all = shown();
    const group = (title: string, items: Choice[]): (HTMLElement | null)[] =>
      items.length
        ? [
            h('h3', null, title),
            h(
              'div',
              { class: 'ngrid' },
              items.map((c) => card(c, c === all[0] && filter.value !== '')),
            ),
          ]
        : [];
    replaceChildren(
      list,
      group(
        'ytenrich',
        all.filter((c) => !c.native),
      ),
      group(
        'This YouTube page',
        all.filter((c) => c.native),
      ),
      all.length ? null : h('p', { class: 'muted' }, 'No view matches.'),
    );
  };
  const filter = h('input', {
    type: 'search',
    class: 'wide',
    placeholder: 'Type to filter, Enter opens the first match',
    oninput: update,
    onkeydown: (e) => {
      const key = (e as KeyboardEvent).key;
      const first = shown()[0];
      if (key === 'Enter' && first) api.pick(first.kind);
      if (key === 'Escape') api.close();
    },
  });
  el.replaceChildren(
    h('div', { class: 'stats-head' }, h('h2', null, 'What should this tab show?'), filter),
    list,
  );
  update();
  return { update, focus: () => filter.focus(), dispose: () => undefined };
}
