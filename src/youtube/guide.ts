// The guide (hamburger sidebar) as a WM tile. YouTube stamps the guide only on first drawer open, so
// wakeGuide() opens and closes the drawer once while it is hidden by CSS ([ytenrich-guide-wake]).
import { GUIDE_BUTTON, GUIDE_DRAWER, GUIDE_RENDERER } from './selectors.ts';
import { waitFor } from './wait.ts';

const WAKE = 'ytenrich-guide-wake';
const STAMP_MS = 3000;
const SETTLE_MS = 400; // drawer close transition
let waking: Promise<boolean> | undefined;

const button = (): HTMLElement | null => {
  const host = document.querySelector<HTMLElement>(GUIDE_BUTTON);
  return host?.querySelector<HTMLElement>('button') ?? host;
};

export function wakeGuide(): Promise<boolean> {
  if (document.querySelector(GUIDE_RENDERER)) return Promise.resolve(true);
  const btn = button();
  const drawer = document.querySelector(GUIDE_DRAWER);
  // Too early in page load: answer now (not memoized) so the projector's retry can wake it later.
  if (!btn || !drawer) return Promise.resolve(false);
  waking ??= (async () => {
    const html = document.documentElement;
    html.setAttribute(WAKE, '');
    try {
      btn.click();
      const ok = await waitFor(() => document.querySelector(GUIDE_RENDERER) ?? undefined, STAMP_MS);
      if (drawer.hasAttribute('opened')) btn.click();
      await new Promise((r) => setTimeout(r, SETTLE_MS));
      return Boolean(ok);
    } finally {
      html.removeAttribute(WAKE);
      waking = undefined;
    }
  })();
  return waking;
}

/** Intercepts user clicks on the masthead hamburger (our own synthetic clicks pass through). */
export function onGuideButton(fn: () => void): () => void {
  const listener = (e: MouseEvent): void => {
    if (!e.isTrusted || !(e.target as Element | null)?.closest?.(GUIDE_BUTTON)) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    fn();
  };
  window.addEventListener('click', listener, true);
  return () => window.removeEventListener('click', listener, true);
}
