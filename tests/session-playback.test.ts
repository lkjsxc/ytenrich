import { describe, expect, it, vi } from 'vitest';
import { dom, fixture } from './session-fixture.ts';

describe('playback session lifecycle', () => {
  it('retains one video through browse pages and marks only its same-watch return as continued', () => {
    const f = fixture();
    f.browse();
    expect(f.playback.kept.get()).toBe('first');
    for (const kind of ['search', 'channel', 'other'] as const) {
      f.start('browse');
      f.navigate(kind);
      f.settle();
      expect(f.playback.kept.get()).toBe('first');
    }
    expect(dom.minimizeForNavigation).toHaveBeenCalledTimes(1);
    const observed = vi.fn();
    f.page.subscribe((p) => observed(f.playback.continued(p.nav)));
    f.navigate('watch', 'first');
    expect(observed).toHaveBeenLastCalledWith(true);
    expect(f.playback.kept.get()).toBeUndefined();
    expect(document.documentElement.hasAttribute('ytenrich-session')).toBe(false);
    f.navigate('watch', 'first');
    expect(f.playback.continued(f.page.get().nav)).toBe(false);
    expect(dom.stopSessionPlayer).not.toHaveBeenCalled();
  });

  it('counts a selected new video as a new open even if YouTube reuses its media element', () => {
    const f = fixture();
    f.browse();
    f.navigate('watch', 'next');
    expect(f.playback.continued(f.page.get().nav)).toBe(false);
    expect(f.playback.kept.get()).toBeUndefined();
  });

  it('does not label a replaced media element or a fresh document as continuous', () => {
    const f = fixture();
    f.browse();
    dom.sessionMedia.mockReturnValue(document.createElement('video'));
    f.navigate('watch', 'first');
    expect(f.playback.continued(f.page.get().nav)).toBe(false);
    f.playback.dispose();
    const reloaded = fixture();
    expect(reloaded.playback.continued(reloaded.page.get().nav)).toBe(false);
  });

  it('closing stops retained playback and permits a later different video session', () => {
    const f = fixture();
    f.browse();
    f.playback.close();
    expect(dom.stopSessionPlayer).toHaveBeenCalledTimes(1);
    expect(f.playback.kept.get()).toBeUndefined();
    f.navigate('watch', 'first');
    expect(f.playback.continued(f.page.get().nav)).toBe(false);
    f.navigate('watch', 'next');
    f.browse();
    expect(f.playback.kept.get()).toBe('next');
  });

  it.each(['sessionPlayback', 'wmEnabled'] as const)(
    'turning %s off stops the kept video',
    (key) => {
      const f = fixture();
      f.browse();
      f.settings.update((s) => ({ ...s, [key]: false }));
      expect(f.playback.kept.get()).toBeUndefined();
      expect(dom.stopSessionPlayer).toHaveBeenCalledTimes(1);
      f.start('browse');
      expect(dom.minimizeForNavigation).toHaveBeenCalledTimes(1);
    },
  );

  it('waits for navigation settlement before rejecting a failed native miniplayer transition', () => {
    const f = fixture();
    dom.minimizeForNavigation.mockImplementation(() => {});
    f.start('browse');
    f.navigate('home');
    f.tick();
    expect(f.playback.kept.get()).toBe('first');
    f.settle();
    expect(f.playback.kept.get()).toBeUndefined();
    expect(dom.stopSessionPlayer).toHaveBeenCalledTimes(1);
  });

  it('stops retaining when the native miniplayer closes or Shorts replaces the page', () => {
    const f = fixture();
    f.browse();
    f.start('shorts');
    expect(f.playback.kept.get()).toBeUndefined();
    f.navigate('watch', 'next');
    f.browse();
    dom.miniMedia.mockReturnValue(null);
    f.tick();
    expect(f.playback.kept.get()).toBeUndefined();
    expect(dom.stopSessionPlayer).toHaveBeenCalledTimes(2);
  });

  it('does not start a session without space, media, or while already on a watch destination', () => {
    const f = fixture();
    f.playback.allow(false);
    f.start('browse');
    f.playback.allow(true);
    f.start('watch');
    Object.defineProperty(f.video, 'ended', { configurable: true, value: true });
    f.start('browse');
    expect(dom.minimizeForNavigation).not.toHaveBeenCalled();
    expect(f.playback.kept.get()).toBeUndefined();
  });
  it('does not stop while native media moves back to watch before the route signal', () => {
    const f = fixture();
    f.browse();
    f.start('watch');
    dom.miniMedia.mockReturnValue(null);
    f.tick();
    expect(f.playback.kept.get()).toBe('first');
    expect(dom.stopSessionPlayer).not.toHaveBeenCalled();
    f.navigate('watch', 'first');
    expect(f.playback.continued(f.page.get().nav)).toBe(true);
  });
  it('stops a retained player when a selected workspace has no player', async () => {
    const f = fixture();
    f.browse();
    f.playback.allow(false, false);
    await Promise.resolve();
    expect(f.playback.kept.get()).toBeUndefined();
    expect(dom.stopSessionPlayer).toHaveBeenCalledTimes(1);
  });
  it('a later explicit visit to the same video can start another retained session after close', () => {
    const f = fixture();
    f.browse();
    f.playback.close();
    f.navigate('watch', 'first');
    f.browse();
    expect(f.playback.kept.get()).toBe('first');
  });

  it('stops retained playback when the selected workspace has only Player', async () => {
    const f = fixture();
    f.browse();
    f.playback.allow(false, true);
    expect(f.playback.kept.get()).toBe('first');
    await Promise.resolve();
    expect(f.playback.kept.get()).toBeUndefined();
    expect(dom.stopSessionPlayer).toHaveBeenCalledTimes(1);
  });
  it('does not stop ordinary watch playback or a session whose room returns synchronously', async () => {
    const f = fixture();
    f.playback.allow(false, true);
    await Promise.resolve();
    expect(dom.stopSessionPlayer).not.toHaveBeenCalled();
    f.playback.allow(true, true);
    f.browse();
    f.playback.allow(false, true);
    f.playback.allow(true, true);
    await Promise.resolve();
    expect(f.playback.kept.get()).toBe('first');
    expect(dom.stopSessionPlayer).not.toHaveBeenCalled();
  });
});
