// Notes above the Recommended list: the one-time choice of how much to collect, and the images hint.
import { h } from '../shared/h.ts';
import { patchSettings, type Settings } from '../shared/settings.ts';
import { PRIVACY_URL } from './consent.ts';

/** Stats that were enabled before the collector existed keep the old behaviour until the user chooses. */
function collectAsk(): HTMLElement {
  return h(
    'section',
    { class: 'consent' },
    h('h2', null, 'Collect more recommendations?'),
    h(
      'p',
      null,
      'ytenrich can fill this list with every recommendation YouTube puts on your pages, not only ' +
        'the ones that reached your screen, and let YouTube load more of its own list on a page ' +
        'whose list your layout hides. Everything still stays in this browser. ',
      h('a', { href: PRIVACY_URL, target: '_blank', rel: 'noopener' }, 'Privacy policy'),
    ),
    h(
      'div',
      { class: 'actions' },
      h(
        'button',
        { class: 'primary', onclick: () => void patchSettings({ collect: 'more' }) },
        'Collect more',
      ),
      h(
        'button',
        { onclick: () => void patchSettings({ collect: 'shown' }) },
        'Only what I was shown',
      ),
    ),
  );
}

function imagesHint(): HTMLElement {
  return h(
    'p',
    { class: 'muted actions' },
    'Images are off. ',
    h(
      'button',
      {
        title: 'Loads thumbnails by requesting video IDs from YouTube’s image server',
        onclick: () => void patchSettings({ thumbnailsEnabled: true }),
      },
      'Show images',
    ),
  );
}

export function recoNotes(s: Settings): (HTMLElement | null)[] {
  return [
    s.statsEnabled && s.collect === 'ask' ? collectAsk() : null,
    !__FIREFOX__ && !s.thumbnailsEnabled ? imagesHint() : null,
  ];
}
