// Stats disclosure. Stats are on from the start because they are what ytenrich is for (the store listing says
// so first); the welcome page states plainly what is kept and offers the switch, and so does the Stats view
// whenever stats are off.
import { h } from '../shared/h.ts';
import { patchSettings } from '../shared/settings.ts';

export const PRIVACY_URL = 'https://github.com/lkjsxc/ytenrich/blob/main/PRIVACY.md';

/** What is kept and where, with the one switch for it. `on`: the current state of stats. */
export function statsCard(on: boolean): HTMLElement {
  return h(
    'section',
    { class: 'consent' },
    h('h2', null, on ? 'Stats are on' : 'Stats are off'),
    h(
      'p',
      null,
      'ytenrich records the recommendations YouTube puts on your pages and the videos you open ' +
        '(video ID, title, channel, counts and times). The record powers your Stats, History and the ' +
        'recommended Videos, Shorts and Channels lists. To fill those lists, ytenrich also lets ' +
        'YouTube load more of its own list on a page.',
    ),
    h(
      'p',
      null,
      'Everything stays in this browser and is never sent to the developer or anyone else. ' +
        (__FIREFOX__
          ? ''
          : 'The lists show thumbnails, loaded from YouTube’s image server by video ID (Settings turns them off). ') +
        'You can clear the record at any time in Settings. ',
      h('a', { href: PRIVACY_URL, target: '_blank', rel: 'noopener' }, 'Privacy policy'),
    ),
    h(
      'div',
      { class: 'actions' },
      on
        ? h(
            'button',
            { onclick: () => void patchSettings({ statsEnabled: false }) },
            'Turn stats off',
          )
        : h(
            'button',
            { class: 'primary', onclick: () => void patchSettings({ statsEnabled: true }) },
            'Turn stats on',
          ),
    ),
  );
}
