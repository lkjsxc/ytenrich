import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import '../src/youtube/bridge-selection.ts';

type Player = HTMLElement & { getVideoData?: () => { video_id?: string } };
let watch: HTMLElement;
let player: Player;
let video: HTMLVideoElement;
let expand: HTMLButtonElement;
let id: string | undefined;
const read = vi.fn(() => ({ video_id: id }));
const router = vi.fn();
const expanded = vi.fn();
const emit = (type = 'playing', target: EventTarget = video): void => {
  target.dispatchEvent(new Event(type)); // Real media events do not bubble; the bridge captures them.
};
beforeEach(() => {
  vi.useFakeTimers();
  read.mockClear();
  router.mockClear();
  expanded.mockClear();
  document.documentElement.setAttribute('ytenrich-wm', '');
  document.documentElement.setAttribute('ytenrich-session', '');
  Object.defineProperty(document, 'fullscreenElement', { configurable: true, value: null });
  watch = document.createElement('ytd-watch-flexy');
  watch.setAttribute('video-id', 'original123');
  watch.hidden = true;
  const mini = document.createElement('ytd-miniplayer');
  player = document.createElement('div');
  player.id = 'movie_player';
  player.getVideoData = read;
  video = document.createElement('video');
  expand = document.createElement('button');
  expand.className = 'ytp-miniplayer-expand-watch-page-button';
  expand.addEventListener('click', expanded);
  player.append(video, expand);
  mini.append(player);
  const app = document.createElement('ytd-app') as HTMLElement & { onYtNavigate: typeof router };
  app.onYtNavigate = router;
  app.append(watch, mini);
  document.body.replaceChildren(app);
  id = 'selected123';
});
afterEach(() => {
  document.dispatchEvent(new Event('yt-navigate-finish'));
  document.documentElement.removeAttribute('ytenrich-wm');
  document.documentElement.removeAttribute('ytenrich-session');
  Reflect.deleteProperty(document, 'fullscreenElement');
  document.body.replaceChildren();
  vi.useRealTimers();
});

describe('loaded miniplayer selection handoff', () => {
  it('expands the loaded new video once without asking the router to load it again', () => {
    expand.addEventListener('click', () => {
      watch.setAttribute('video-id', id!);
      watch.hidden = false;
      watch.append(player); // Native Expand moves the same player back to watch.
      document.documentElement.removeAttribute('ytenrich-session');
      document.dispatchEvent(new Event('yt-navigate-finish'));
    });
    emit('loadedmetadata');
    emit();
    emit();
    expect(expanded).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(1);
    vi.runAllTimers();
    expect(read).toHaveBeenCalledTimes(1);
    expect(expanded).toHaveBeenCalledTimes(1);
    expect(watch.contains(video)).toBe(true);
    emit();
    vi.runAllTimers();
    expect(expanded).toHaveBeenCalledTimes(1);
    expect(router).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('ignores ad metadata while the content video still matches the kept watch page', () => {
    id = 'original123';
    player.classList.add('ad-showing');
    const title = document.createElement('a');
    title.className = 'ytp-title-link';
    title.textContent = 'An advertisement with no content URL';
    player.append(title);
    emit('loadedmetadata');
    emit();
    vi.runAllTimers();
    expect(read).toHaveBeenCalledTimes(1);
    expect(expanded).not.toHaveBeenCalled();
    expect(router).not.toHaveBeenCalled();
  });

  it('can expand a newly selected content video during its preroll', () => {
    player.classList.add('ad-showing');
    emit();
    vi.runAllTimers();
    expect(expanded).toHaveBeenCalledTimes(1);
    expect(router).not.toHaveBeenCalled();
  });

  it.each([undefined, '', 'short', 'bad id123', 'bad/id123', 'x'.repeat(65)])(
    'ignores an absent or invalid native content ID: %s',
    (value) => {
      id = value;
      emit();
      vi.runAllTimers();
      expect(expanded).not.toHaveBeenCalled();
    },
  );

  it.each(['ytenrich-wm', 'ytenrich-session'])(
    'requires %s when scheduling and when running',
    (gate) => {
      document.documentElement.removeAttribute(gate);
      emit();
      expect(vi.getTimerCount()).toBe(0);
      document.documentElement.setAttribute(gate, '');
      emit();
      document.documentElement.removeAttribute(gate);
      vi.runAllTimers();
      expect(read).not.toHaveBeenCalled();
      expect(expanded).not.toHaveBeenCalled();
    },
  );

  it('leaves fullscreen to the native player', () => {
    emit();
    Object.defineProperty(document, 'fullscreenElement', { value: player });
    vi.runAllTimers();
    expect(read).not.toHaveBeenCalled();
    expect(expanded).not.toHaveBeenCalled();
  });

  it('ignores non-media targets and media outside the miniplayer', () => {
    emit('playing', player);
    emit('loadedmetadata', document);
    watch.append(video);
    emit();
    vi.runAllTimers();
    expect(read).not.toHaveBeenCalled();
    expect(expanded).not.toHaveBeenCalled();
  });

  it('does nothing if the player or Expand control disappears before the frame', () => {
    emit();
    player.remove();
    vi.runAllTimers();
    expect(expanded).not.toHaveBeenCalled();
    const mini = document.querySelector('ytd-miniplayer')!;
    mini.append(player);
    expand.remove();
    emit();
    vi.runAllTimers();
    expect(read).toHaveBeenCalledTimes(1);
    expect(expanded).not.toHaveBeenCalled();
  });

  it('contains an absent or changed native getter without a playback request', () => {
    delete player.getVideoData;
    emit();
    expect(() => vi.runAllTimers()).not.toThrow();
    player.getVideoData = () => {
      throw new Error('Native player changed');
    };
    emit();
    expect(() => vi.runAllTimers()).not.toThrow();
    expect(expanded).not.toHaveBeenCalled();
    expect(router).not.toHaveBeenCalled();
  });

  it('cancels the queued handoff when native navigation completes', () => {
    emit();
    document.dispatchEvent(new Event('yt-navigate-finish'));
    expect(vi.getTimerCount()).toBe(0);
    vi.runAllTimers();
    expect(read).not.toHaveBeenCalled();
    expect(expanded).not.toHaveBeenCalled();
  });
});
