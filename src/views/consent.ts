// Stats consent: stores require an in-extension disclosure and an explicit "yes" before any
// recommendation is counted (Chrome Web Store user data policy). Shown on the welcome page and in Stats.
import { h } from '../shared/h.ts';
import { patchSettings } from '../shared/settings.ts';

export const PRIVACY_URL = 'https://github.com/lkjsxc/ytenrich/blob/main/PRIVACY.md';

/** `onNo` runs after "Not now"; enabling stats reaches every view through the settings signal. */
export function consentCard(onNo: () => void): HTMLElement {
  return h(
    'section',
    { class: 'consent' },
    h('h2', null, 'Enable stats?'),
    h(
      'p',
      null,
      'ytenrich can record the recommendations YouTube puts on your pages and the videos you open ' +
        '(video ID, title, channel, counts and times). The record powers your Stats, the Recommended ' +
        'list and the optional hiding of recommendations that keep reappearing unopened. To fill ' +
        'Recommended, ytenrich also lets YouTube load more of its own list on a page.',
    ),
    h(
      'p',
      null,
      'Everything stays in this browser and is never sent to the developer or anyone else. ' +
        (__FIREFOX__
          ? ''
          : 'The lists show thumbnails, loaded from YouTube’s image server by video ID (Settings turns them off). ') +
        'You can turn stats off or clear them at any time in Settings. ',
      h('a', { href: PRIVACY_URL, target: '_blank', rel: 'noopener' }, 'Privacy policy'),
    ),
    h(
      'div',
      { class: 'actions' },
      h(
        'button',
        {
          class: 'primary',
          onclick: () => void patchSettings({ statsEnabled: true, collect: 'more' }),
        },
        'Enable stats',
      ),
      h('button', { onclick: onNo }, 'Not now'),
    ),
  );
}
