import { afterEach, beforeEach, describe, expect, it, type Mock, vi } from 'vitest';
import '../src/youtube/bridge-size.ts';

type Size = { width: number; height: number };
let size: Size;
let slot: HTMLElement;
let video: HTMLVideoElement;
let player: HTMLElement & {
  getPlayerSize?: () => Size;
  setInternalSize?: (width: number, height: number) => void;
};
let resize: Mock<(width: number, height: number) => void>;
const emit = (target: EventTarget = slot, detail?: unknown): void => {
  target.dispatchEvent(
    new CustomEvent('ytenrich-player-resize', { bubbles: true, composed: true, detail }),
  );
};
const nativeWrite = (width: number, height: number): void => {
  size = { width, height };
  video.style.width = `${width}px`;
  video.style.height = `${height}px`;
};
beforeEach(() => {
  vi.useFakeTimers();
  document.documentElement.setAttribute('ytenrich-wm', '');
  Object.defineProperty(document, 'fullscreenElement', { configurable: true, value: null });
  const mini = document.createElement('ytd-miniplayer');
  slot = document.createElement('div');
  slot.id = 'player-container';
  slot.setAttribute('ytenrich-slot', 'player');
  slot.getBoundingClientRect = () => new DOMRect(12, 78, 947.4, 525.6);
  player = document.createElement('div');
  player.id = 'movie_player';
  video = document.createElement('video');
  player.append(video);
  size = { width: 400, height: 225 };
  player.getPlayerSize = () => size;
  resize = vi.fn<(width: number, height: number) => void>(nativeWrite);
  player.setInternalSize = resize;
  slot.append(player);
  mini.append(slot);
  document.body.replaceChildren(mini);
});
afterEach(async () => {
  document.documentElement.removeAttribute('ytenrich-wm');
  await vi.runAllTimersAsync();
  Reflect.deleteProperty(document, 'fullscreenElement');
  document.body.replaceChildren();
  vi.useRealTimers();
});

describe('native miniplayer size bridge', () => {
  it('uses rounded current tile geometry and ignores dimensions supplied in event detail', () => {
    emit(slot, { width: 1, height: 2, player: 'foreign' });
    expect(resize).toHaveBeenCalledExactlyOnceWith(947, 526);
    slot.getBoundingClientRect = () => new DOMRect(28, 80, 610.6, 344.2);
    emit();
    expect(resize).toHaveBeenLastCalledWith(611, 344);
    expect(resize).toHaveBeenCalledTimes(2);
  });

  it.each([
    ['tiling off', () => document.documentElement.removeAttribute('ytenrich-wm')],
    ['inactive slot', () => slot.setAttribute('ytenrich-slot-inactive', '')],
    ['wrong slot', () => slot.setAttribute('ytenrich-slot', 'page')],
    [
      'zero width',
      () => {
        slot.getBoundingClientRect = () => new DOMRect(0, 0, 0, 500);
      },
    ],
    [
      'zero height',
      () => {
        slot.getBoundingClientRect = () => new DOMRect(0, 0, 900, 0);
      },
    ],
    ['fullscreen', () => Object.defineProperty(document, 'fullscreenElement', { value: player })],
    [
      'missing setter',
      () => {
        delete player.setInternalSize;
      },
    ],
    [
      'missing measurement',
      () => {
        delete player.getPlayerSize;
      },
    ],
  ] as const)('keeps ordinary sizing with %s', (_name, change) => {
    change();
    emit();
    expect(resize).not.toHaveBeenCalled();
  });

  it('does not resize the ordinary watch player or a descendant posing as the slot', () => {
    emit(player, { width: 900, height: 500 });
    expect(resize).not.toHaveBeenCalled();
    const watch = document.createElement('ytd-watch-flexy');
    watch.append(slot);
    document.body.replaceChildren(watch);
    emit();
    expect(resize).not.toHaveBeenCalled();
  });

  it('ignores non-element targets and a missing player without throwing', () => {
    expect(() => emit(document)).not.toThrow();
    player.remove();
    expect(() => emit()).not.toThrow();
    expect(resize).not.toHaveBeenCalled();
  });

  it('corrects a delayed native reset without responding repeatedly to its own style writes', async () => {
    emit();
    await vi.runAllTimersAsync();
    expect(resize).toHaveBeenCalledTimes(1);
    emit(); // Correct native measurements require no further write.
    expect(resize).toHaveBeenCalledTimes(1);
    nativeWrite(400, 225);
    expect(resize).toHaveBeenCalledTimes(1); // Mutation work is batched to a frame.
    await vi.runAllTimersAsync();
    expect(resize).toHaveBeenCalledTimes(2);
    expect(resize).toHaveBeenLastCalledWith(947, 526);
    expect(size).toEqual({ width: 947, height: 526 });
    await vi.runAllTimersAsync();
    expect(resize).toHaveBeenCalledTimes(2);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('disconnects when tiling stops and requires a new projection before correcting again', async () => {
    emit();
    await vi.runAllTimersAsync();
    document.documentElement.removeAttribute('ytenrich-wm');
    await vi.runAllTimersAsync();
    nativeWrite(400, 225);
    document.documentElement.setAttribute('ytenrich-wm', '');
    await vi.runAllTimersAsync();
    expect(resize).toHaveBeenCalledTimes(1);
    emit();
    expect(resize).toHaveBeenCalledTimes(2);
  });

  it('contains native sizing errors and stops retrying from later style mutations', async () => {
    resize.mockImplementation(() => {
      throw new Error('native sizing changed');
    });
    expect(() => emit()).not.toThrow();
    expect(resize).toHaveBeenCalledExactlyOnceWith(947, 526);
    nativeWrite(420, 230);
    await vi.runAllTimersAsync();
    expect(resize).toHaveBeenCalledTimes(1);
    expect(slot.getAttribute('ytenrich-slot')).toBe('player');
    expect(slot.contains(player)).toBe(true);
  });
});
