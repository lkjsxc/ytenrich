// Own cards first try a matching native anchor (views/open.ts). The bridge covers videos absent from the DOM.
// A transient DOM node carries one URL and an acknowledgement; there is no retained request collection.
import { SITE } from './site.ts';

export function navigateWatch(href: string): boolean {
  if (SITE !== 'youtube' || location.hostname !== 'www.youtube.com' || !document.body) return false;
  const link = document.createElement('a');
  link.href = href;
  link.hidden = true;
  link.setAttribute('ytenrich-navigation', 'request');
  document.body.append(link);
  try {
    link.dispatchEvent(new Event('ytenrich-navigate-watch', { bubbles: true }));
    return link.getAttribute('ytenrich-navigation') === 'accepted';
  } finally {
    link.remove();
  }
}
