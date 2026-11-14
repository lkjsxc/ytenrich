// Stats disclosure. Stats are on from the start because they are what ytenrich is for (the store listing says
// so first). Installing opens YouTube, where the welcome card above the Recommended lists states plainly what is
// kept and offers the switch until it is acknowledged; the Stats view shows the same while stats are off.
import { h } from '../shared/h.ts';
import { patchSettings } from '../shared/settings.ts';

export const PRIVACY_URL = 'https://github.com/lkjsxc/ytenrich/blob/main/PRIVACY.md';

const disclosure = (): HTMLElement[] => [
  h(
    'p',
    null,
    'ytenrich records the recommendations YouTube puts on your pages and the videos you open ' +
      '(video ID, title, channel, counts and times). The record powers your Stats, History and the ' +
      'recommended Videos, Shorts, Mix lists and Channels lists. To fill those lists, ytenrich also lets ' +
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
];

const toggle = (on: boolean, primary: boolean): HTMLElement =>
  on
    ? h('button', { onclick: () => void patchSettings({ statsEnabled: false }) }, 'Turn stats off')
    : h(
        'button',
        {
          class: primary ? 'primary' : '',
          onclick: () => void patchSettings({ statsEnabled: true }),
        },
        'Turn stats on',
      );

/** What is kept and where, with the one switch for it. `on`: the current state of stats. */
export function statsCard(on: boolean): HTMLElement {
  return h(
    'section',
    { class: 'consent' },
    h('h2', null, on ? 'Stats are on' : 'Stats are off'),
    disclosure(),
    h('div', { class: 'actions' }, toggle(on, true)),
  );
}

/** First run, on YouTube itself: what ytenrich does, what it records, the switch, and "Got it". */
export function introCard(on: boolean): HTMLElement {
  return h(
    'section',
    { class: 'consent' },
    h('h2', null, 'Welcome to ytenrich'),
    h(
      'p',
      null,
      'Every YouTube page is now a tiling layout: drag tabs to split, join or reorder panes, ☰ shows the ' +
        'Guide as a tile, and the numbers in the masthead switch workspaces. These lists are ytenrich’s own ' +
        'recommendations; ▶ beside the search box sets what each tab shows.',
    ),
    disclosure(),
    h(
      'div',
      { class: 'actions' },
      h(
        'button',
        { class: 'primary', onclick: () => void patchSettings({ introDone: true }) },
        'Got it',
      ),
      toggle(on, false),
    ),
  );
}
