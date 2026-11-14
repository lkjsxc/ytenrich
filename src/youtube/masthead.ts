import { NAV_END } from './music.ts';
import { MASTHEAD_START } from './selectors.ts';
import { SITE } from './site.ts';

/** Puts `el` (the workspace switcher) in the masthead's own flow: after the logo on YouTube, before the search
 * box; in YouTube Music at the head of the nav bar's right-hand group. Cheap to call again after DOM changes: it
 * acts only while `el` is out of the document (the masthead renders late, and may be rebuilt). */
export function placeInMasthead(el: HTMLElement): void {
  if (el.isConnected) return;
  if (SITE === 'music') document.querySelector(NAV_END)?.prepend(el);
  else document.querySelector(MASTHEAD_START)?.after(el);
}
