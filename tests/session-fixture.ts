import { afterEach, beforeEach, vi } from 'vitest';
import type { Page } from '../src/content/route-signal.ts';
import { DEFAULT_SETTINGS } from '../src/shared/settings.ts';
import { createSignal } from '../src/shared/signal.ts';
import { NAV_EVENT } from '../src/youtube/route.ts';
import { createPlayback } from '../src/youtube/session.ts';

const handlers = vi.hoisted(() => ({
  miniMedia: vi.fn(),
  minimizeForNavigation: vi.fn(),
  onSessionNavigation: vi.fn(),
  sessionMedia: vi.fn(),
  stopSessionPlayer: vi.fn(),
  watchIdentity: vi.fn(),
}));
vi.mock('../src/youtube/session-dom.ts', () => handlers);
export const dom = handlers;

const cleanup: (() => void)[] = []; // bound: fixtures in the current test
beforeEach(() => {
  vi.useFakeTimers();
  vi.clearAllMocks();
});
afterEach(() => {
  for (const dispose of cleanup.splice(0)) dispose();
  vi.useRealTimers();
});

export function fixture() {
  const settings = createSignal({ ...DEFAULT_SETTINGS });
  const page = createSignal<Page>({
    kind: 'watch',
    videoId: 'first',
    nav: 1,
    url: 'https://www.youtube.com/watch?v=first',
  });
  const video = document.createElement('video');
  Object.defineProperties(video, {
    currentSrc: { configurable: true, value: 'blob:first' },
    ended: { configurable: true, value: false },
  });
  let start: (kind: 'watch' | 'shorts' | 'browse') => void = () => {};
  let tick: () => void = () => {};
  dom.sessionMedia.mockReturnValue(video);
  dom.miniMedia.mockReturnValue(null);
  dom.watchIdentity.mockReturnValue('first');
  dom.minimizeForNavigation.mockImplementation(() => dom.miniMedia.mockReturnValue(video));
  dom.onSessionNavigation.mockImplementation((fn) => {
    start = fn;
    return () => {};
  });
  const playback = createPlayback(settings, page, (fn) => {
    tick = fn;
    return () => {};
  });
  playback.allow(true);
  cleanup.push(playback.dispose);
  const navigate = (kind: Page['kind'], id?: string): void => {
    if (id) dom.watchIdentity.mockReturnValue(id);
    page.set({
      kind,
      videoId: id,
      nav: page.get().nav + 1,
      url: `https://www.youtube.com${id ? `/watch?v=${id}` : '/'}`,
    });
  };
  const settle = (): void => {
    document.dispatchEvent(new Event(NAV_EVENT));
    vi.runOnlyPendingTimers();
  };
  return {
    settings,
    page,
    video,
    playback,
    navigate,
    settle,
    start: (kind: 'watch' | 'shorts' | 'browse') => start(kind),
    tick: () => tick(),
    browse: () => {
      start('browse');
      navigate('home');
      settle();
    },
  };
}
