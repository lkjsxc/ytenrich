import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

let handle: EventListener;
let app: HTMLElement & { onYtNavigate?: ReturnType<typeof vi.fn> };
let watch: HTMLElement;
let video: HTMLVideoElement;
const path = '/results?search_query=music';
const endpoint = (url = path) => ({
  commandMetadata: { webCommandMetadata: { url } },
  browseEndpoint: { browseId: 'native-result' },
});
// Happy DOM cannot create trusted browser traversals. Invoke the registered handler with controlled provenance;
// the live smoke proves real trusted Back/Forward. The source still registers its actual capture listener.
beforeAll(async () => {
  const added = vi.spyOn(window, 'addEventListener');
  await import('../src/youtube/bridge.ts');
  const registration = added.mock.calls.find(([type]) => type === 'popstate');
  expect(registration?.[2]).toBe(true);
  handle = registration?.[1] as EventListener;
  added.mockRestore();
});
const invoke = (state: unknown = { endpoint: endpoint() }, trusted = true) => {
  history.replaceState(state, '', location.href);
  const stop = vi.fn();
  handle({
    isTrusted: trusted,
    state: { endpoint: endpoint('/forged-event-detail') },
    stopImmediatePropagation: stop,
  } as unknown as Event);
  return stop;
};
const media = (currentSrc = 'blob:kept', ended = false): void => {
  Object.defineProperties(video, {
    currentSrc: { configurable: true, value: currentSrc },
    ended: { configurable: true, value: ended },
  });
};
beforeEach(() => {
  history.replaceState({}, '', path);
  document.documentElement.setAttribute('ytenrich-wm', '');
  document.documentElement.setAttribute('ytenrich-session-ready', '');
  Object.defineProperty(document, 'fullscreenElement', { configurable: true, value: null });
  app = document.createElement('ytd-app');
  watch = document.createElement('ytd-watch-flexy');
  const player = document.createElement('div');
  player.id = 'movie_player';
  video = document.createElement('video');
  media();
  player.append(video);
  watch.append(player);
  app.append(watch);
  document.body.replaceChildren(app);
  app.onYtNavigate = vi.fn(() => document.dispatchEvent(new Event('yt-navigate-start')));
});
afterEach(() => {
  document.documentElement.removeAttribute('ytenrich-wm');
  document.documentElement.removeAttribute('ytenrich-session-ready');
  Reflect.deleteProperty(document, 'fullscreenElement');
  document.body.replaceChildren();
});

describe('native cached history bridge', () => {
  it('uses the current native endpoint, ignores event state, and consumes an acknowledged traversal', () => {
    const native = endpoint();
    const stop = invoke({ endpoint: native });
    expect(app.onYtNavigate).toHaveBeenCalledExactlyOnceWith({
      detail: { endpoint: native, type: 'navigate-back' },
    });
    expect(app.onYtNavigate?.mock.calls[0]?.[0].detail.endpoint).toBe(history.state.endpoint);
    expect(stop).toHaveBeenCalledTimes(1);
    expect(location.pathname + location.search).toBe(path);
  });

  it('accepts the same destination expressed as an absolute native URL', () => {
    const stop = invoke({ endpoint: endpoint(location.href) });
    expect(app.onYtNavigate).toHaveBeenCalledTimes(1);
    expect(stop).toHaveBeenCalledTimes(1);
  });

  it('ignores an untrusted event even when current history and playback are eligible', () => {
    const stop = invoke({ endpoint: endpoint() }, false);
    expect(app.onYtNavigate).not.toHaveBeenCalled();
    expect(stop).not.toHaveBeenCalled();
  });

  it.each([
    ['tiling off', () => document.documentElement.removeAttribute('ytenrich-wm')],
    ['session not ready', () => document.documentElement.removeAttribute('ytenrich-session-ready')],
    ['hidden watch', () => watch.setAttribute('hidden', '')],
    ['unloaded video', () => media('')],
    ['ended video', () => media('blob:kept', true)],
    ['fullscreen', () => Object.defineProperty(document, 'fullscreenElement', { value: app })],
    ['watch destination', () => history.replaceState({}, '', '/watch?v=firstid')],
    ['Shorts destination', () => history.replaceState({}, '', '/shorts/shortid')],
  ] as const)('keeps native popstate for %s', (_name, change) => {
    change();
    const stop = invoke({ endpoint: endpoint(location.pathname + location.search) });
    expect(app.onYtNavigate).not.toHaveBeenCalled();
    expect(stop).not.toHaveBeenCalled();
  });

  it.each([
    null,
    {},
    { endpoint: {} },
    { endpoint: endpoint('/different') },
    { endpoint: endpoint('https://example.com/results?search_query=music') },
    { endpoint: endpoint('https://[') },
  ])('requires a native history endpoint for exactly the current destination', (state) => {
    const stop = invoke(state);
    expect(app.onYtNavigate).not.toHaveBeenCalled();
    expect(stop).not.toHaveBeenCalled();
  });

  it('falls through if the native method is unavailable, throws, or gives no synchronous acknowledgement', () => {
    delete app.onYtNavigate;
    expect(invoke()).not.toHaveBeenCalled();
    app.onYtNavigate = vi.fn(() => {
      throw new Error('native router changed');
    });
    expect(invoke()).not.toHaveBeenCalled();
    app.onYtNavigate = vi.fn();
    expect(invoke()).not.toHaveBeenCalled();
  });

  it('does not mistake a later unrelated navigation for an acknowledgement', async () => {
    app.onYtNavigate = vi.fn(() => {
      queueMicrotask(() => document.dispatchEvent(new Event('yt-navigate-start')));
    });
    expect(invoke()).not.toHaveBeenCalled();
    await Promise.resolve();
    app.onYtNavigate = vi.fn();
    expect(invoke()).not.toHaveBeenCalled();
  });
});
