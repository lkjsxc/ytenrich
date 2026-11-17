// Native miniplayer control through DOM events only. Verified live 2026-11-17; no page-world API or bridge.
import { pageKind } from './route.ts';

const PLAYER = '#movie_player';
const MINI = 'ytd-miniplayer';
/** Native navigation stays on this origin; malformed or external destinations keep their ordinary handling. */
function localUrl(value: unknown): URL | undefined {
  if (typeof value !== 'string') return;
  try {
    const url = new URL(value, location.origin);
    return url.origin === location.origin ? url : undefined;
  } catch {
    return;
  }
}
let minimizing = false; // one synchronous shortcut call; intercepted by the early window listener below
export const sessionMedia = (): HTMLVideoElement | null =>
  document.querySelector<HTMLVideoElement>(`${PLAYER} video`);
export const miniMedia = (): HTMLVideoElement | null =>
  document.querySelector<HTMLVideoElement>(`${MINI} ${PLAYER} video`);
export const watchIdentity = (): string | undefined =>
  document.querySelector('ytd-watch-flexy')?.getAttribute('video-id') || undefined;

/** The player moves between two containers; the watch container may remain empty after minimization. */
export const sessionPlayerSlot = (): HTMLElement | null =>
  document.querySelector<HTMLElement>(
    'ytd-watch-flexy #player-container:has(#movie_player), ytd-miniplayer #player-container:has(#movie_player)',
  );

/** The native shortcut also requests its previous browse page. Suppress only that synchronous request: the
 * user's navigation is already in flight. Starting it outside a navigation lets the watch page undo the move. */
export function minimizeForNavigation(): void {
  minimizing = true;
  try {
    document.querySelector(PLAYER)?.dispatchEvent(
      new KeyboardEvent('keydown', {
        key: 'i',
        code: 'KeyI',
        keyCode: 73,
        which: 73,
        bubbles: true,
        cancelable: true,
      }),
    );
  } finally {
    minimizing = false;
  }
}

export function stopSessionPlayer(): void {
  sessionMedia()?.pause();
  if (miniMedia())
    document.querySelector<HTMLElement>(`${MINI} .ytp-miniplayer-close-button`)?.click();
}

/** Both fresh and cached SPA navigations announce their destination. Back/Forward changes the address before
 * Cached watch restoration needs skipHistory during traversal. A fresh DOM event crosses the isolated-world
 * boundary; assigning a property to the site's existing detail object does not. */
export function onSessionNavigation(
  prepare: (kind: 'watch' | 'shorts' | 'browse') => void,
): () => void {
  let busy = false;
  let forwarding = false; // one synchronous click on the native link with the same destination
  const click = (event: MouseEvent): void => {
    if (
      forwarding ||
      event.defaultPrevented ||
      event.button ||
      event.ctrlKey ||
      event.metaKey ||
      event.shiftKey ||
      event.altKey
    )
      return;
    if (!document.documentElement.matches('[ytenrich-session], [ytenrich-session-ready]')) return;
    const link =
      event.target instanceof Element ? event.target.closest<HTMLAnchorElement>('a[href]') : null;
    if (!link || link.target || link.matches('.yt-simple-endpoint')) return;
    const url = localUrl(link.href);
    if (!url || pageKind(url) !== 'channel') return;
    const page = link.closest('[ytenrich-slot=page]');
    // Search avatars can be plain hard-navigation links. Their adjacent channel-name link owns the SPA endpoint.
    for (const native of page?.querySelectorAll<HTMLAnchorElement>('a.yt-simple-endpoint[href]') ??
      []) {
      if (native === link || native.href !== link.href) continue;
      event.preventDefault();
      forwarding = true;
      try {
        native.click();
      } finally {
        forwarding = false;
      }
      return;
    }
  };
  let historyTarget = ''; // bound: the one pending Back/Forward destination
  const finish = (): void => {
    historyTarget = '';
  };
  const start = (event: Event): void => {
    const detail = (event as CustomEvent).detail;
    const path =
      detail?.url ??
      detail?.data?.url ??
      detail?.endpoint?.commandMetadata?.webCommandMetadata?.url;
    const url = path == null ? undefined : localUrl(path);
    if (path != null && !url) return;
    if (minimizing && ['yt-navigate', 'yt-navigate-cache'].includes(event.type)) {
      event.stopImmediatePropagation();
      return;
    }
    if (busy || event.type === 'yt-navigate') return;
    if (event.type === 'popstate') {
      historyTarget = document.documentElement.hasAttribute('ytenrich-session')
        ? location.href
        : '';
      return;
    }
    // Native miniplayer restoration otherwise pushes the watch page again and discards Forward history.
    if (
      event.type === 'yt-navigate-cache' &&
      historyTarget &&
      typeof detail?.url === 'string' &&
      event.target instanceof Element &&
      event.target.closest(MINI) &&
      url?.href === historyTarget
    ) {
      historyTarget = '';
      event.stopImmediatePropagation();
      event.target.dispatchEvent(
        new CustomEvent(event.type, {
          bubbles: true,
          composed: true,
          detail: { ...detail, skipHistory: true },
        }),
      );
      return;
    }
    const page = detail?.pageType ?? detail?.data?.page;
    let kind = page === 'watch' || page === 'shorts' ? page : 'browse';
    if (url) {
      const route = pageKind(url);
      kind = route === 'watch' || route === 'shorts' ? route : 'browse';
    } else if (typeof page !== 'string') return;
    busy = true;
    try {
      prepare(kind);
    } finally {
      busy = false;
    }
  };
  // Installed at document_start, before YouTube's window capture handlers can change history.
  window.addEventListener('yt-navigate', start, true);
  window.addEventListener('yt-navigate-start', start, true);
  window.addEventListener('yt-navigate-cache', start, true);
  window.addEventListener('popstate', start, true);
  document.addEventListener('yt-navigate-finish', finish);
  document.addEventListener('click', click);
  return () => {
    window.removeEventListener('yt-navigate', start, true);
    window.removeEventListener('yt-navigate-start', start, true);
    window.removeEventListener('yt-navigate-cache', start, true);
    window.removeEventListener('popstate', start, true);
    document.removeEventListener('yt-navigate-finish', finish);
    document.removeEventListener('click', click);
  };
}
