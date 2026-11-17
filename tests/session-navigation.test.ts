import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createRouteSignal } from '../src/content/route-signal.ts';
import { DEFAULT_SETTINGS } from '../src/shared/settings.ts';
import { createSignal } from '../src/shared/signal.ts';
import { createPlayback } from '../src/youtube/session.ts';
import { minimizeForNavigation, onSessionNavigation } from '../src/youtube/session-dom.ts';

const cleanup: (() => void)[] = []; // bound: listeners installed by the current test
let app: HTMLElement;
let mini: HTMLElement;
let player: HTMLElement;
const emit = (target: EventTarget, type: string, detail: unknown): void => {
  target.dispatchEvent(new CustomEvent(type, { bubbles: true, composed: true, detail }));
};
const address = (path: string): void => history.replaceState({}, '', path);
const traverse = (path: string): void => {
  address(path);
  window.dispatchEvent(new PopStateEvent('popstate'));
};
const observe = () => {
  const prepare = vi.fn();
  cleanup.push(onSessionNavigation(prepare));
  const received = vi.fn();
  app.addEventListener('yt-navigate-cache', (e) => received((e as CustomEvent).detail));
  return { prepare, received };
};
beforeEach(() => {
  address('/watch?v=firstid');
  app = document.createElement('ytd-app');
  mini = document.createElement('ytd-miniplayer');
  player = document.createElement('div');
  player.id = 'movie_player';
  app.append(player, mini);
  document.body.replaceChildren(app);
});
afterEach(() => {
  for (const dispose of cleanup.splice(0).reverse()) dispose();
  document.documentElement.removeAttribute('ytenrich-session');
  document.body.replaceChildren();
});

describe('native session navigation', () => {
  it('publishes only the finished route, after native playback preparation', () => {
    const route = createRouteSignal();
    cleanup.push(route.dispose);
    const order: string[] = [];
    cleanup.push(route.page.subscribe((p) => order.push(`finished:${p.kind}`)));
    cleanup.push(onSessionNavigation((kind) => order.push(`prepare:${kind}`)));
    traverse('/results?search_query=music');
    expect(route.page.get()).toMatchObject({ kind: 'watch', nav: 1 });
    expect(order).toEqual([]);
    emit(app, 'yt-navigate-start', { url: '/results?search_query=music' });
    expect(route.page.get().kind).toBe('watch');
    document.dispatchEvent(new Event('yt-navigate-finish'));
    expect(route.page.get()).toMatchObject({ kind: 'search', nav: 2 });
    expect(order).toEqual(['prepare:browse', 'finished:search']);
    document.dispatchEvent(new Event('yt-navigate-finish'));
    expect(order).toHaveLength(2);
    route.dispose();
    address('/@channel');
    document.dispatchEvent(new Event('yt-navigate-finish'));
    expect(route.page.get().kind).toBe('search');
  });

  it('restores Back with a fresh skipHistory event without mutating native cached data', () => {
    address('/');
    const route = createRouteSignal();
    cleanup.push(route.dispose);
    cleanup.push(
      route.page.subscribe(() => document.documentElement.removeAttribute('ytenrich-session')),
    );
    const { prepare, received } = observe();
    document.documentElement.setAttribute('ytenrich-session', '');
    traverse('/watch?v=firstid');
    expect(route.page.get().kind).toBe('home');
    expect(document.documentElement.hasAttribute('ytenrich-session')).toBe(true);
    const endpoint = { watchEndpoint: { videoId: 'firstid' } };
    const data = { page: 'watch' };
    const detail = Object.freeze({ url: '/watch?v=firstid', endpoint, data, miniplayer: true });
    emit(mini, 'yt-navigate-cache', detail);
    expect(received).toHaveBeenCalledTimes(1);
    const restored = received.mock.calls[0]?.[0];
    expect(restored).toEqual({ ...detail, skipHistory: true });
    expect(restored).not.toBe(detail);
    expect(restored.endpoint).toBe(endpoint);
    expect(restored.data).toBe(data);
    expect('skipHistory' in detail).toBe(false);
    expect(prepare).toHaveBeenCalledExactlyOnceWith('watch');
    document.dispatchEvent(new Event('yt-navigate-finish'));
    expect(route.page.get().kind).toBe('watch');
    // The traversal token is single use: later native navigation must keep ordinary history semantics.
    emit(mini, 'yt-navigate-cache', detail);
    expect(received.mock.calls[1]?.[0]).toBe(detail);
  });

  it('normalizes absolute cache URLs and ignores other destinations and non-miniplayer events', () => {
    const { received } = observe();
    document.documentElement.setAttribute('ytenrich-session', '');
    traverse('/watch?v=firstid');
    const elsewhere = { url: '/results?search_query=other' };
    emit(mini, 'yt-navigate-cache', elsewhere);
    const same = { url: location.href, data: { page: 'watch' } };
    emit(app, 'yt-navigate-cache', same);
    expect(received.mock.calls.map(([detail]) => detail)).toEqual([elsewhere, same]);
    emit(mini, 'yt-navigate-cache', same);
    expect(received.mock.calls[2]?.[0]).toEqual({ ...same, skipHistory: true });
  });

  it('leaves ordinary navigation and a finished traversal untouched', () => {
    const { received } = observe();
    const detail = { url: '/watch?v=firstid' };
    traverse('/watch?v=firstid');
    emit(mini, 'yt-navigate-cache', detail);
    expect(received.mock.calls[0]?.[0]).toBe(detail);
    document.documentElement.setAttribute('ytenrich-session', '');
    traverse('/watch?v=firstid');
    document.dispatchEvent(new Event('yt-navigate-finish'));
    emit(mini, 'yt-navigate-cache', detail);
    expect(received.mock.calls[1]?.[0]).toBe(detail);
  });

  it('suppresses only synchronous shortcut navigation and leaves later native events available', () => {
    const { prepare, received } = observe();
    const navigate = vi.fn();
    app.addEventListener('yt-navigate', navigate);
    player.addEventListener('keydown', (e) => {
      expect((e as KeyboardEvent).code).toBe('KeyI');
      emit(mini, 'yt-navigate-cache', { url: '/' });
      emit(mini, 'yt-navigate', { url: '/' });
    });
    minimizeForNavigation();
    expect(received).not.toHaveBeenCalled();
    expect(navigate).not.toHaveBeenCalled();
    expect(prepare).not.toHaveBeenCalled();
    emit(mini, 'yt-navigate-cache', { url: '/' });
    emit(mini, 'yt-navigate', { url: '/' });
    expect(received).toHaveBeenCalledTimes(1);
    expect(navigate).toHaveBeenCalledTimes(1);
    expect(prepare).toHaveBeenCalledExactlyOnceWith('browse');
  });

  it('disposes the cache interceptor and accepts native endpoint destinations', () => {
    const prepare = vi.fn();
    const dispose = onSessionNavigation(prepare);
    const endpoint = { commandMetadata: { webCommandMetadata: { url: '/shorts/shortid' } } };
    emit(app, 'yt-navigate-start', { endpoint });
    expect(prepare).toHaveBeenCalledExactlyOnceWith('shorts');
    dispose();
    emit(app, 'yt-navigate-start', { url: '/watch?v=firstid' });
    expect(prepare).toHaveBeenCalledTimes(1);
  });

  it('keeps the history bridge ready only for an eligible watch layout and clears it on dispose', () => {
    const watch = document.createElement('ytd-watch-flexy');
    watch.setAttribute('video-id', 'firstid');
    watch.append(player);
    app.prepend(watch);
    const video = document.createElement('video');
    video.pause = vi.fn();
    player.append(video);
    const settings = createSignal({ ...DEFAULT_SETTINGS });
    const route = createRouteSignal();
    const playback = createPlayback(settings, route.page, () => () => {});
    cleanup.push(route.dispose, playback.dispose);
    const ready = () => document.documentElement.hasAttribute('ytenrich-session-ready');
    playback.allow(true);
    expect(ready()).toBe(true);
    settings.update((s) => ({ ...s, sessionPlayback: false }));
    expect(ready()).toBe(false);
    settings.update((s) => ({ ...s, sessionPlayback: true }));
    expect(ready()).toBe(true);
    playback.close();
    expect(ready()).toBe(false);
    expect(video.pause).toHaveBeenCalledTimes(1);
    address('/watch?v=firstid&list=RDrepeat');
    document.dispatchEvent(new Event('yt-navigate-finish'));
    expect(ready()).toBe(true);
    address('/results?search_query=music');
    document.dispatchEvent(new Event('yt-navigate-finish'));
    expect(ready()).toBe(false);
    address('/watch?v=firstid');
    document.dispatchEvent(new Event('yt-navigate-finish'));
    expect(ready()).toBe(true);
    playback.allow(false);
    expect(ready()).toBe(false);
    playback.allow(true);
    playback.dispose();
    expect(ready()).toBe(false);
  });
});
