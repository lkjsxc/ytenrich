import type { Window as TestWindow } from 'happy-dom';
import { afterEach, beforeEach, describe, expect, it, type Mock, vi } from 'vitest';
import { minimizeForNavigation, onSessionNavigation } from '../src/youtube/session-dom.ts';

const testWindow = window as unknown as TestWindow;
const navigation = testWindow.happyDOM.settings.navigation;
const previousNavigation = { ...navigation };
let page: HTMLElement;
let avatar: HTMLAnchorElement;
let native: HTMLAnchorElement;
let image: HTMLElement;
type Prepare = (kind: 'watch' | 'shorts' | 'browse') => void;
let prepare: Mock<Prepare>;
let nativeClicks: Mock<() => void>;
let dispose: () => void;
const emit = (target: EventTarget, type: string, detail: unknown): void => {
  target.dispatchEvent(new CustomEvent(type, { bubbles: true, composed: true, detail }));
};
const click = (target: EventTarget = image, options: MouseEventInit = {}): MouseEvent => {
  const event = new MouseEvent('click', { bubbles: true, cancelable: true, ...options });
  target.dispatchEvent(event);
  return event;
};
beforeEach(() => {
  // Happy DOM follows anchor defaults during bubbling; keep that simulation from changing the tested origin.
  Object.assign(navigation, {
    disableMainFrameNavigation: true,
    disableChildPageNavigation: true,
    disableFallbackToSetURL: true,
  });
  testWindow.happyDOM.setURL('https://www.youtube.com/results?search_query=music');
  page = document.createElement('ytd-search');
  page.setAttribute('ytenrich-slot', 'page');
  avatar = document.createElement('a');
  avatar.href = '/@channel';
  image = document.createElement('img');
  avatar.append(image);
  native = document.createElement('a');
  native.href = avatar.href;
  native.classList.add('yt-simple-endpoint');
  page.append(avatar, native);
  document.body.replaceChildren(page);
  document.documentElement.setAttribute('ytenrich-session-ready', '');
  prepare = vi.fn<Prepare>();
  nativeClicks = vi.fn<() => void>();
  native.addEventListener('click', (event) => {
    event.preventDefault();
    nativeClicks();
    emit(native, 'yt-navigate-start', { url: native.href });
  });
  dispose = onSessionNavigation(prepare);
});
afterEach(() => {
  dispose();
  Object.assign(navigation, previousNavigation);
  document.documentElement.removeAttribute('ytenrich-session');
  document.documentElement.removeAttribute('ytenrich-session-ready');
  document.body.replaceChildren();
});

describe('session channel-link alias', () => {
  it.each(['ytenrich-session', 'ytenrich-session-ready'])(
    'delegates an unhandled avatar click to its native endpoint while %s',
    (marker) => {
      document.documentElement.removeAttribute('ytenrich-session-ready');
      document.documentElement.setAttribute(marker, '');
      const original = click();
      expect(original.defaultPrevented).toBe(true);
      expect(nativeClicks).toHaveBeenCalledTimes(1);
      expect(prepare).toHaveBeenCalledExactlyOnceWith('browse');
    },
  );

  it('leaves handled clicks and direct native endpoint clicks with their existing handlers', () => {
    avatar.addEventListener('click', (event) => event.preventDefault(), { once: true });
    expect(click().defaultPrevented).toBe(true);
    expect(nativeClicks).not.toHaveBeenCalled();
    click(native);
    expect(nativeClicks).toHaveBeenCalledTimes(1);
    expect(prepare).toHaveBeenCalledExactlyOnceWith('browse');
  });

  it.each([
    { ctrlKey: true },
    { metaKey: true },
    { shiftKey: true },
    { altKey: true },
    { button: 1 },
    { button: 2 },
  ])('preserves modified and non-primary click behavior (%j)', (options) => {
    expect(click(image, options).defaultPrevented).toBe(false);
    expect(nativeClicks).not.toHaveBeenCalled();
    expect(prepare).not.toHaveBeenCalled();
  });

  it.each([
    ['no session', () => document.documentElement.removeAttribute('ytenrich-session-ready')],
    [
      'new target',
      () => {
        avatar.target = '_blank';
      },
    ],
    ['outside Page', () => page.removeAttribute('ytenrich-slot')],
    [
      'no native match',
      () => {
        native.href = '/@other';
      },
    ],
    [
      'external destination',
      () => {
        avatar.href = native.href = 'https://example.com/@channel';
      },
    ],
    [
      'malformed destination',
      () => {
        avatar.setAttribute('href', 'https://[');
      },
    ],
    [
      'non-channel destination',
      () => {
        avatar.href = native.href = '/watch?v=firstid';
      },
    ],
  ] as const)('keeps ordinary handling with %s', (_name, change) => {
    change();
    expect(click().defaultPrevented).toBe(false);
    expect(nativeClicks).not.toHaveBeenCalled();
    expect(prepare).not.toHaveBeenCalled();
  });

  it('removes click forwarding when disposed', () => {
    dispose();
    expect(click().defaultPrevented).toBe(false);
    expect(nativeClicks).not.toHaveBeenCalled();
  });
});

describe('native event URL validation', () => {
  it.each(['https://[', 'https://example.com/watch?v=foreign', 'javascript:void(0)', 42])(
    'ignores an explicit malformed or external destination %s without hiding the event',
    (url) => {
      const seen = vi.fn();
      const mini = document.createElement('ytd-miniplayer');
      page.append(mini);
      page.addEventListener('yt-navigate-cache', seen);
      document.documentElement.setAttribute('ytenrich-session', '');
      window.dispatchEvent(new PopStateEvent('popstate'));
      emit(mini, 'yt-navigate-start', { url, pageType: 'watch' });
      emit(mini, 'yt-navigate-cache', { url, pageType: 'watch' });
      expect(prepare).not.toHaveBeenCalled();
      expect(seen).toHaveBeenCalledTimes(1);
    },
  );

  it('accepts same-origin URLs and native page types with no explicit URL', () => {
    emit(page, 'yt-navigate-start', { url: '/watch?v=firstid' });
    emit(page, 'yt-navigate-start', { url: new URL('/@channel', location.origin).href });
    emit(page, 'yt-navigate-start', { data: { page: 'shorts' } });
    expect(prepare.mock.calls.map(([kind]) => kind)).toEqual(['watch', 'browse', 'shorts']);
  });

  it('does not suppress an external navigation emitted while the shortcut is running', () => {
    const player = document.createElement('div');
    player.id = 'movie_player';
    page.append(player);
    const seen = vi.fn();
    page.addEventListener('yt-navigate-cache', seen);
    player.addEventListener('keydown', () => {
      emit(player, 'yt-navigate-cache', { url: 'https://example.com/' });
    });
    minimizeForNavigation();
    expect(seen).toHaveBeenCalledTimes(1);
    expect(prepare).not.toHaveBeenCalled();
  });
});
