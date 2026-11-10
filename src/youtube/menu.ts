// One-click "Not interested": drive YouTube's own menu with the popup made invisible.
import { NOT_INTERESTED_LABELS, normalizeLabel } from './i18n-labels.ts';
import { MENU_BUTTON, MENU_ITEM, MENU_ITEM_CLICK } from './selectors.ts';
import { waitFor } from './wait.ts';

export type DismissResult =
  | { readonly ok: true }
  | {
      readonly ok: false;
      readonly reason: 'no-button' | 'no-menu' | 'no-item';
      readonly labels: string[];
    };
const SILENT = 'ytenrich-silent-menu';
const OPEN_MS = 3000; // some menus fetch their items over the network on open
const CLOSE_MS = 600;
const SETTLE_MS = 400; // items shown this long without a match: the label is not in this menu

const shown = (): HTMLElement[] =>
  [...document.querySelectorAll<HTMLElement>(MENU_ITEM)].filter((el) => el.offsetParent !== null);
const text = (el: Element): string => (el.textContent ?? '').replace(/\s+/g, ' ').trim();
const pressEscape = (): void => {
  document.dispatchEvent(
    new KeyboardEvent('keydown', { key: 'Escape', keyCode: 27, bubbles: true }),
  );
};

export async function clickNotInterested(
  root: Element,
  extraLabel: string,
): Promise<DismissResult> {
  const button = root.querySelector<HTMLElement>(MENU_BUTTON);
  if (!button) return { ok: false, reason: 'no-button', labels: [] };
  const labels = new Set(
    [...NOT_INTERESTED_LABELS, extraLabel].filter(Boolean).map(normalizeLabel),
  );
  const html = document.documentElement;
  html.setAttribute(SILENT, '');
  try {
    // A menu still open (or closing) from an earlier action would be matched instead of this item's.
    if (shown().length) {
      pressEscape();
      await waitFor(() => (shown().length ? undefined : true), CLOSE_MS);
    }
    button.click();
    let since = 0;
    const item = await waitFor(() => {
      const items = shown();
      const hit = items.find((el) => labels.has(normalizeLabel(text(el))));
      if (hit || !items.length) return hit;
      since ||= performance.now();
      return performance.now() - since > SETTLE_MS ? null : undefined;
    }, OPEN_MS);
    if (item) {
      (item.querySelector<HTMLElement>(MENU_ITEM_CLICK) ?? item).click();
      return { ok: true };
    }
    const seen = shown().map(text);
    pressEscape();
    return { ok: false, reason: seen.length ? 'no-item' : 'no-menu', labels: seen };
  } finally {
    setTimeout(() => html.removeAttribute(SILENT), 300);
  }
}
