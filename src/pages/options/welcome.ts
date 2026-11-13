// Welcome page (options.html#welcome): what ytenrich does, what it records, and the switch. Install opens YouTube
// instead (views/consent.ts `introCard`); this page stays for the store screenshots and direct links.
import { h } from '../../shared/h.ts';
import type { Settings } from '../../shared/settings.ts';
import type { Signal } from '../../shared/signal.ts';
import { statsCard } from '../../views/consent.ts';

export function welcome(settings: Signal<Settings>): HTMLElement {
  const answer = h('div');
  const render = (s: Settings): void => answer.replaceChildren(statsCard(s.statsEnabled));
  render(settings.get());
  settings.subscribe(render);
  return h(
    'section',
    { class: 'welcome' },
    h('h1', null, 'ytenrich is installed'),
    h(
      'ul',
      null,
      h(
        'li',
        null,
        'Every YouTube page becomes a tiling layout, with nine workspaces switched from the masthead.',
      ),
      h('li', null, 'Drag tabs to split, join or reorder panes. ☰ shows the Guide as a tile.'),
      h(
        'li',
        null,
        'The ⊘ button next to each recommendation tells YouTube "Not interested" in one click.',
      ),
    ),
    answer,
    h('p', null, h('a', { href: 'https://www.youtube.com/' }, 'Open YouTube')),
  );
}
