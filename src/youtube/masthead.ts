import { MASTHEAD_START } from './selectors.ts';

/** Puts `el` after the logo, in the masthead's own flow. Cheap to call again after DOM changes: it acts only
 * while `el` is out of the document (the masthead renders late, and may be rebuilt). */
export function placeInMasthead(el: HTMLElement): void {
  if (!el.isConnected) document.querySelector(MASTHEAD_START)?.append(el);
}
