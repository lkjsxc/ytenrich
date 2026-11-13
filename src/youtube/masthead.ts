import { MASTHEAD_START } from './selectors.ts';

/** Puts `el` between the logo and the search box, in the masthead's own flow. Cheap to call again after DOM changes: it acts only
 * while `el` is out of the document (the masthead renders late, and may be rebuilt). */
export function placeInMasthead(el: HTMLElement): void {
  if (!el.isConnected) document.querySelector(MASTHEAD_START)?.after(el);
}
