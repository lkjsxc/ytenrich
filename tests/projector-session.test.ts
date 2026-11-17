import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Log } from '../src/shared/log.ts';
import { createProjector, type Projector } from '../src/wm/projector.ts';
import { resolveSlot } from '../src/youtube/slots.ts';

vi.mock('../src/youtube/slots.ts', () => ({ resolveSlot: vi.fn() }));

const resolve = vi.mocked(resolveSlot);
const observe = vi.fn();
const disconnect = vi.fn();
const resized = vi.fn();
const fitted = vi.fn();
let projector: Projector;
let body: HTMLElement;
let miniSlot: HTMLElement;
let watchSlot: HTMLElement;
let video: HTMLVideoElement;
const geometry = (el: HTMLElement): string[] =>
  ['left', 'top', 'width', 'height'].map((property) => el.style.getPropertyValue(property));

function resizeObserver(): Pick<ResizeObserver, 'observe' | 'disconnect' | 'unobserve'> {
  return { observe, disconnect, unobserve: vi.fn() };
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal('ResizeObserver', resizeObserver);
  observe.mockClear();
  disconnect.mockClear();
  resized.mockClear();
  fitted.mockClear();
  resolve.mockReset();
  body = document.createElement('div');
  body.getBoundingClientRect = () => new DOMRect(0, 93, 947, 550);
  miniSlot = document.createElement('div');
  watchSlot = document.createElement('div');
  video = document.createElement('video');
  miniSlot.append(video);
  document.body.replaceChildren(body, miniSlot, watchSlot);
  resolve.mockReturnValue(miniSlot);
  window.addEventListener('resize', resized);
  document.addEventListener('ytenrich-player-resize', fitted);
  projector = createProjector({ write: vi.fn() } as unknown as Log);
  projector.sync([{ slot: 'player', body }]);
  vi.runAllTimers();
  resized.mockClear();
  fitted.mockClear();
});
afterEach(() => {
  projector.dispose();
  window.removeEventListener('resize', resized);
  document.removeEventListener('ytenrich-player-resize', fitted);
  document.body.replaceChildren();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('projection after the native player changes containers', () => {
  it('projects a late watch container into the original tile without a window resize', () => {
    // Navigation has finished and refreshed the old owner, but YouTube has not moved the player yet.
    projector.refresh();
    vi.runAllTimers();
    resized.mockClear();
    fitted.mockClear();
    const original = geometry(miniSlot);
    expect(original).toEqual(['0px', '93px', '947px', '550px']);
    watchSlot.append(video); // The native move happens after that completed navigation.
    resolve.mockReturnValue(watchSlot);
    projector.reconcile();
    expect(vi.getTimerCount()).toBe(1);
    vi.advanceTimersToNextFrame();
    expect(watchSlot.getAttribute('ytenrich-slot')).toBe('player');
    expect(geometry(watchSlot)).toEqual(original);
    expect(watchSlot.contains(video)).toBe(true);
    expect(miniSlot.hasAttribute('ytenrich-slot')).toBe(false);
    expect(miniSlot.hasAttribute('ytenrich-slot-inactive')).toBe(false);
    expect(miniSlot.hasAttribute('ytenrich-part')).toBe(false);
    expect(geometry(miniSlot)).toEqual(['', '', '', '']);
    expect(resized).not.toHaveBeenCalled(); // Geometry is fixed before the later synthetic refit.
    vi.runAllTimers();
    expect(resized).toHaveBeenCalledTimes(1);
    expect(fitted).toHaveBeenCalledTimes(1);
    expect((fitted.mock.calls[0]![0] as Event).target).toBe(watchSlot);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('coalesces repeated ownership checks and does no work for an unchanged owner', () => {
    expect(vi.getTimerCount()).toBe(0);
    for (let i = 0; i < 20; i++) projector.reconcile();
    expect(vi.getTimerCount()).toBe(0);
    expect(resized).not.toHaveBeenCalled();
    expect(fitted).not.toHaveBeenCalled();
    resolve.mockReturnValue(watchSlot);
    for (let i = 0; i < 20; i++) projector.reconcile();
    expect(vi.getTimerCount()).toBe(1);
    vi.runAllTimers();
    expect(resized).toHaveBeenCalledTimes(1);
    expect(fitted).toHaveBeenCalledTimes(1);
    for (let i = 0; i < 20; i++) projector.reconcile();
    expect(vi.getTimerCount()).toBe(0);
    vi.runAllTimers();
    expect(resized).toHaveBeenCalledTimes(1);
    expect(fitted).toHaveBeenCalledTimes(1);
  });

  it('releases a disappeared owner and recovers when a replacement appears', () => {
    resolve.mockReturnValue(null);
    projector.reconcile();
    vi.runAllTimers();
    expect(miniSlot.hasAttribute('ytenrich-slot')).toBe(false);
    expect(body.classList.contains('empty')).toBe(true);
    projector.reconcile();
    expect(vi.getTimerCount()).toBe(0);
    watchSlot.append(video);
    resolve.mockReturnValue(watchSlot);
    projector.reconcile();
    vi.runAllTimers();
    expect(body.classList.contains('empty')).toBe(false);
    expect(watchSlot.getAttribute('ytenrich-slot')).toBe('player');
    expect(geometry(watchSlot)).toEqual(['0px', '93px', '947px', '550px']);
  });

  it('cancels a pending ownership handoff and all refits on disposal', () => {
    watchSlot.append(video);
    resolve.mockReturnValue(watchSlot);
    projector.reconcile();
    expect(vi.getTimerCount()).toBe(1);
    projector.dispose();
    resized.mockClear(); // Release itself deliberately sends one native resize.
    fitted.mockClear();
    projector.reconcile();
    vi.runAllTimers();
    expect(vi.getTimerCount()).toBe(0);
    expect(miniSlot.hasAttribute('ytenrich-slot')).toBe(false);
    expect(watchSlot.hasAttribute('ytenrich-slot')).toBe(false);
    expect(geometry(miniSlot)).toEqual(['', '', '', '']);
    expect(resized).not.toHaveBeenCalled();
    expect(fitted).not.toHaveBeenCalled();
    expect(disconnect).toHaveBeenCalled();
  });
});
