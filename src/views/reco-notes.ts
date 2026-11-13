// Notes above the Recommended list: the first-run welcome card and the images hint.
import { h } from '../shared/h.ts';
import { patchSettings, type Settings } from '../shared/settings.ts';
import { introCard } from './consent.ts';

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
    s.introDone ? null : introCard(s.statsEnabled),
    !__FIREFOX__ && !s.thumbnailsEnabled ? imagesHint() : null,
  ];
}
