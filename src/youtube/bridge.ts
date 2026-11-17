// MAIN world, youtube.com only: native navigation and projected miniplayer sizing.
// Bare navigation events and cached traversal are insufficient; no extension APIs or stored statistics are read.
import './bridge-size.ts';
import './bridge-selection.ts';
import { pageKind } from './route.ts';

type App = Element & {
  onYtNavigate?: (event: { detail: { endpoint: unknown; type?: string } }) => void;
};

function openWatch(address: string): boolean {
  if (address.length > 512) return false;
  let url: URL;
  try {
    url = new URL(address, location.origin);
  } catch {
    return false;
  }
  const id = url.searchParams.get('v');
  const list = url.searchParams.get('list');
  if (
    url.origin !== 'https://www.youtube.com' ||
    url.pathname !== '/watch' ||
    !id ||
    !/^[\w-]{6,64}$/.test(id) ||
    (list && !/^[\w-]{1,200}$/.test(list))
  )
    return false;
  const app = document.querySelector<App>('ytd-app');
  if (typeof app?.onYtNavigate !== 'function') return false;
  const query = new URLSearchParams({ v: id });
  if (list) query.set('list', list);
  const radio = list && url.searchParams.get('start_radio') === '1';
  if (radio) query.set('start_radio', '1');
  const path = `/watch?${query}`;
  const endpoint = {
    commandMetadata: {
      webCommandMetadata: { url: path, webPageType: 'WEB_PAGE_TYPE_WATCH', rootVe: 3832 },
    },
    watchEndpoint: {
      videoId: id,
      ...(list ? { playlistId: list } : {}),
      ...(radio ? { startRadio: true } : {}),
    },
  };
  // Native selection while minimized starts playback without a navigation acknowledgement.
  // bridge-selection restores its watch page once the new content ID is loaded.
  const minimized =
    document.documentElement.matches('[ytenrich-wm][ytenrich-session]') &&
    Boolean(document.querySelector('ytd-miniplayer #movie_player'));
  let accepted = false;
  const start = (): void => {
    accepted = true;
  };
  document.addEventListener('yt-navigate-start', start);
  document.addEventListener('yt-navigate-cache', start);
  try {
    app.onYtNavigate({ detail: { endpoint } });
    return accepted || minimized || location.pathname + location.search === path;
  } catch {
    return false;
  } finally {
    document.removeEventListener('yt-navigate-start', start);
    document.removeEventListener('yt-navigate-cache', start);
  }
}

document.addEventListener('ytenrich-navigate-watch', (event) => {
  const link = event.target;
  if (
    !(link instanceof HTMLAnchorElement) ||
    link.getAttribute('ytenrich-navigation') !== 'request'
  )
    return;
  if (openWatch(link.href)) link.setAttribute('ytenrich-navigation', 'accepted');
});

/** A cached browse traversal skips navigate-start and unloads the watch player. Ask the native router to
 * traverse its own current endpoint instead; navigate-back preserves the browser's existing history entry. */
window.addEventListener(
  'popstate',
  (event) => {
    if (
      !event.isTrusted ||
      !document.documentElement.matches('[ytenrich-wm][ytenrich-session-ready]')
    )
      return;
    const kind = pageKind(new URL(location.href));
    if (kind === 'watch' || kind === 'shorts' || document.fullscreenElement) return;
    const video = document.querySelector<HTMLVideoElement>(
      'ytd-watch-flexy:not([hidden]) #movie_player video',
    );
    if (!video?.currentSrc || video.ended) return;
    const endpoint = history.state?.endpoint;
    const path = endpoint?.commandMetadata?.webCommandMetadata?.url;
    if (typeof path !== 'string') return;
    try {
      if (new URL(path, location.origin).href !== location.href) return;
    } catch {
      return;
    }
    const app = document.querySelector<App>('ytd-app');
    if (typeof app?.onYtNavigate !== 'function') return;
    let accepted = false;
    const start = (): void => {
      accepted = true;
    };
    document.addEventListener('yt-navigate-start', start);
    try {
      app.onYtNavigate({ detail: { endpoint, type: 'navigate-back' } });
    } catch {
      // An unsupported app keeps its ordinary native popstate path.
    } finally {
      document.removeEventListener('yt-navigate-start', start);
    }
    if (accepted) event.stopImmediatePropagation();
  },
  true,
);
