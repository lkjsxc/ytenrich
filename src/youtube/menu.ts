// One-click "Not interested": drive YouTube's own menu with the popup made invisible.
import { NOT_INTERESTED_LABELS, normalizeLabel } from './i18n-labels.ts';
import { MENU_BUTTON, MENU_ITEM, MENU_ITEM_CLICK } from './selectors.ts';
import { waitFor } from './wait.ts';

export type DismissResult = 'ok' | 'no-menu' | 'no-item';
const SILENT = 'ytenrich-silent-menu';
const TIMEOUT_MS = 1500;

function findItem(labels: ReadonlySet<string>): HTMLElement | undefined {
  for (const el of document.querySelectorAll<HTMLElement>(MENU_ITEM)) {
    if (el.offsetParent === null) continue;
    if (labels.has(normalizeLabel(el.textContent ?? '')))
      return el.querySelector<HTMLElement>(MENU_ITEM_CLICK) ?? el;
  }
  return undefined;
}

export async function clickNotInterested(
  root: Element,
  extraLabel: string,
): Promise<DismissResult> {
  const button = root.querySelector<HTMLElement>(MENU_BUTTON);
  if (!button) return 'no-menu';
  const labels = new Set(
    [...NOT_INTERESTED_LABELS, extraLabel].filter(Boolean).map(normalizeLabel),
  );
  const html = document.documentElement;
  html.setAttribute(SILENT, '');
  try {
    button.click();
    const item = await waitFor(() => findItem(labels), TIMEOUT_MS);
    if (item) {
      item.click();
      return 'ok';
    }
    document.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Escape', keyCode: 27, bubbles: true }),
    );
    return 'no-item';
  } finally {
    setTimeout(() => html.removeAttribute(SILENT), 300);
  }
}
