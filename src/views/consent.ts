// Recording consent: stores require an in-extension disclosure and an explicit "yes" before any
// recommendation is recorded (Chrome Web Store user data policy). Shown on the welcome page and in Stats.
import { h } from '../shared/h.ts';
import { patchSettings } from '../shared/settings.ts';

export const PRIVACY_URL = 'https://github.com/lkjsxc/ytenrich/blob/main/PRIVACY.md';

/** `onNo` runs after "Not now"; turning recording on reaches every view through the settings signal. */
export function consentCard(onNo: () => void): HTMLElement {
  return h(
    'section',
    { class: 'consent' },
    h('h2', null, 'Record recommendations on this device?'),
    h(
      'p',
      null,
      'ytenrich can keep a record of the YouTube recommendations you are shown and the videos you open ' +
        '(video ID, title, channel, counts and times). It powers your Stats and the hiding of ' +
        'recommendations that keep reappearing without being opened.',
    ),
    h(
      'p',
      null,
      'The record stays in this browser and is never sent to the developer or anyone else. ' +
        'You can turn it off or clear it at any time in Settings. ',
      h('a', { href: PRIVACY_URL, target: '_blank', rel: 'noopener' }, 'Privacy policy'),
    ),
    h(
      'div',
      { class: 'actions' },
      h(
        'button',
        { class: 'primary', onclick: () => void patchSettings({ statsEnabled: true }) },
        'Start recording',
      ),
      h('button', { onclick: onNo }, 'Not now'),
    ),
  );
}
