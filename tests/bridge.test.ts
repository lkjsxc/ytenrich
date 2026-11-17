import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import '../src/youtube/bridge.ts';
import { navigateWatch } from '../src/youtube/open.ts';

type App = HTMLElement & { onYtNavigate?: (event: unknown) => void };
let app: App;
const router = vi.fn(() => document.dispatchEvent(new Event('yt-navigate-start')));
beforeEach(() => {
  vi.stubGlobal('location', new URL('https://www.youtube.com/'));
  router.mockClear();
  app = document.createElement('ytd-app') as App;
  app.onYtNavigate = router;
  document.body.replaceChildren(app);
});
afterEach(() => {
  document.documentElement.removeAttribute('ytenrich-wm');
  document.documentElement.removeAttribute('ytenrich-session');
  document.body.replaceChildren();
  vi.unstubAllGlobals();
});

it('opens only the selected video/playlist through the page router and removes its request node', () => {
  expect(
    navigateWatch(
      'https://www.youtube.com/watch?v=abcdef12345&list=RDabcdef12345&start_radio=1&tracking=ignored',
    ),
  ).toBe(true);
  expect(router).toHaveBeenCalledWith({
    detail: {
      endpoint: {
        commandMetadata: {
          webCommandMetadata: {
            url: '/watch?v=abcdef12345&list=RDabcdef12345&start_radio=1',
            webPageType: 'WEB_PAGE_TYPE_WATCH',
            rootVe: 3832,
          },
        },
        watchEndpoint: { videoId: 'abcdef12345', playlistId: 'RDabcdef12345', startRadio: true },
      },
    },
  });
  expect(document.querySelector('[ytenrich-navigation]')).toBeNull();
});

it.each([
  'https://example.com/watch?v=abcdef12345',
  'https://www.youtube.com/results?search_query=private',
  'javascript:alert(1)',
  'https://www.youtube.com/watch?v=bad!',
  'https://www.youtube.com/watch?v=abcdef12345&list=../bad',
  `https://www.youtube.com/watch?v=abcdef12345&extra=${'x'.repeat(600)}`,
])('rejects an unsupported request: %s', (url) => {
  expect(navigateWatch(url)).toBe(false);
  expect(router).not.toHaveBeenCalled();
  expect(document.querySelector('[ytenrich-navigation]')).toBeNull();
});

it('declines safely when the native router disappears or throws', () => {
  app.onYtNavigate = undefined;
  expect(navigateWatch('https://www.youtube.com/watch?v=abcdef12345')).toBe(false);
  app.onYtNavigate = () => {
    throw new Error('native API changed');
  };
  expect(navigateWatch('https://www.youtube.com/watch?v=abcdef12345')).toBe(false);
  expect(document.querySelector('[ytenrich-navigation]')).toBeNull();
});

function retainedPlayer(): HTMLElement {
  const mini = document.createElement('ytd-miniplayer');
  const player = document.createElement('div');
  player.id = 'movie_player';
  mini.append(player);
  app.append(mini);
  document.documentElement.setAttribute('ytenrich-wm', '');
  document.documentElement.setAttribute('ytenrich-session', '');
  return player;
}

it('accepts an in-place native selection once without requiring a synchronous route acknowledgement', () => {
  retainedPlayer();
  const select = vi.fn();
  app.onYtNavigate = select;
  expect(navigateWatch('https://www.youtube.com/watch?v=abcdef12345')).toBe(true);
  expect(select).toHaveBeenCalledTimes(1);
  expect(document.querySelector('[ytenrich-navigation]')).toBeNull();
});

it.each(['ytenrich-wm', 'ytenrich-session', 'player'])(
  'does not infer in-place acceptance without %s',
  (gate) => {
    const player = retainedPlayer();
    if (gate === 'player') player.remove();
    else document.documentElement.removeAttribute(gate);
    const select = vi.fn();
    app.onYtNavigate = select;
    expect(navigateWatch('https://www.youtube.com/watch?v=abcdef12345')).toBe(false);
    expect(select).toHaveBeenCalledTimes(1);
  },
);

it('still declines a native exception with a retained player', () => {
  retainedPlayer();
  app.onYtNavigate = () => {
    throw new Error('Native player changed');
  };
  expect(navigateWatch('https://www.youtube.com/watch?v=abcdef12345')).toBe(false);
  expect(document.querySelector('[ytenrich-navigation]')).toBeNull();
});
