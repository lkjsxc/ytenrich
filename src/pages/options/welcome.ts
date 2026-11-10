// First-run welcome (options.html#welcome, opened on install): what ytenrich does, then recording consent.
import { h } from '../../shared/h.ts';
import type { Settings } from '../../shared/settings.ts';
import type { Signal } from '../../shared/signal.ts';
import { consentCard } from '../../views/consent.ts';

export function welcome(settings: Signal<Settings>): HTMLElement {
  const answer = h('div');
  let declined = false;
  const render = (s: Settings): void => {
    answer.replaceChildren(
      s.statsEnabled
        ? h('p', null, 'Recording is on. Your Stats fill up as you browse YouTube.')
        : declined
          ? h(
              'p',
              { class: 'muted' },
              'Recording stays off. You can turn it on later in Stats or Settings.',
            )
          : consentCard(() => ((declined = true), render(settings.get()))),
    );
  };
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
        'Every YouTube page except Shorts becomes a tiling layout. Alt+W turns it off and on.',
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
