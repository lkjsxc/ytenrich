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
      'ytenrich can count the YouTube recommendations you are shown and the videos you open ' +
        '(video ID, title, channel, counts and times). The counts power your Stats and the hiding of ' +
        'recommendations that keep reappearing without being opened.',
    ),
    h(
      'p',
      null,
      'Everything stays in this browser and is never sent to the developer or anyone else. ' +
        'You can turn stats off or clear them at any time in Settings. ',
      h('a', { href: PRIVACY_URL, target: '_blank', rel: 'noopener' }, 'Privacy policy'),
    ),
    h(
      'div',
      { class: 'actions' },
      h(
        'button',
        { class: 'primary', onclick: () => void patchSettings({ statsEnabled: true }) },
        'Enable stats',
      ),
      h('button', { onclick: onNo }, 'Not now'),
    ),
  );
}
