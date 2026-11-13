import { DESCRIPTION, DESCRIPTION_MORE } from './selectors.ts';

/** Clicks the watch page's "…more" while its description is collapsed. True when it did. */
export function expandDescription(): boolean {
  const box = document.querySelector<HTMLElement>(DESCRIPTION);
  if (!box || box.hasAttribute('is-expanded')) return false;
  const more = box.querySelector<HTMLElement>(DESCRIPTION_MORE);
  if (!more || more.hidden || !more.getClientRects().length) return false;
  more.click();
  return true;
}
