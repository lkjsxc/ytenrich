import { describe, expect, it, vi } from 'vitest';
import type { Page } from '../src/content/route-signal.ts';
import type { Runtime } from '../src/content/runtime.ts';
import { createSignal } from '../src/shared/signal.ts';
import * as L from '../src/wm/layout.ts';
import { projectSessionLayout } from '../src/wm/session-layout.ts';
import { createSessionViews } from '../src/wm/session-views.ts';

function fixture() {
  const page = createSignal<Page>({
    kind: 'watch',
    videoId: 'video',
    nav: 1,
    url: 'https://www.youtube.com/watch?v=video',
  });
  const kept = createSignal<string | undefined>(undefined);
  const allow = vi.fn();
  const session = createSessionViews(
    { page, playback: { kept, allow } } as unknown as Runtime,
    'watch',
  );
  const browse = (): void => {
    kept.set('video');
    page.update((p) => ({ ...p, kind: 'home', videoId: undefined, nav: p.nav + 1 }));
  };
  const watch = (): void => {
    kept.set(undefined);
    page.update((p) => ({ ...p, kind: 'watch', videoId: 'video', nav: p.nav + 1 }));
  };
  return { session, browse, watch, allow };
}
const base = (): L.SplitNode =>
  L.split('row', [L.pane(['player']), L.pane(['recommended', 'history'])], [0.65, 0.35]);

describe('temporary session Page', () => {
  it('never saves the injected tab and restores the original companion on return to watch', () => {
    const f = fixture();
    const root = base();
    expect(f.session.navigate(root, root)).toBe(root);
    f.browse();
    const browsing = f.session.navigate(root, root);
    expect(L.paneOfView(browsing, 'page')?.active).toBe('page');
    expect(f.session.saved(browsing)).toEqual(root);
    expect(L.paneOfView(browsing, 'page')).toBeDefined();
    f.watch();
    expect(f.session.navigate(browsing, browsing)).toEqual(root);
  });

  it('keeps user divider edits while saving and returning without the transient Page', () => {
    const f = fixture();
    const root = base();
    f.browse();
    const browsing = f.session.navigate(root, root);
    const resized = L.resize(browsing, root.id, [0.45, 0.55]);
    const expected = L.resize(root, root.id, [0.45, 0.55]);
    expect(f.session.saved(resized)).toEqual(expected);
    f.watch();
    expect(f.session.navigate(resized, resized)).toEqual(expected);
  });

  it('allows another tab to stay active until the next browse navigation', () => {
    const f = fixture();
    const root = base();
    f.browse();
    const browsing = f.session.navigate(root, root);
    const history = L.activate(browsing, 'history');
    expect(f.session.navigate(history, history)).toBe(history);
    expect(L.paneOfView(f.session.saved(history), 'history')?.active).toBe('history');
    f.browse();
    expect(L.paneOfView(f.session.navigate(history, history), 'page')?.active).toBe('page');
  });

  it('preserves a user-saved Page tab and its earlier active companion', () => {
    const f = fixture();
    const root = L.split('row', [L.pane(['player']), L.pane(['page', 'history'], 'history')]);
    f.browse();
    const browsing = f.session.navigate(root, root);
    expect(f.session.saved(browsing)).toEqual(root);
    f.watch();
    expect(f.session.navigate(browsing, browsing)).toEqual(root);
  });

  it('restores a saved Page sharing the player pane after moving it aside for browsing', () => {
    const f = fixture();
    const root = L.split('row', [L.pane(['player', 'page']), L.pane(['recommended'])]);
    f.browse();
    const browsing = f.session.navigate(root, root);
    expect(L.paneOfView(browsing, 'page')?.id).not.toBe(L.paneOfView(root, 'player')?.id);
    expect(f.session.saved(browsing)).toEqual(root);
    f.watch();
    expect(f.session.navigate(browsing, browsing)).toEqual(root);
  });

  it('chooses only a visible neighbour and keeps absent optional tabs in the saved tree', () => {
    const f = fixture();
    const hidden = L.pane(['chapters']);
    const root = L.split('row', [L.pane(['player']), hidden, L.pane(['history'])], [0.4, 0.5, 0.1]);
    const visible = L.removeView(root, 'chapters')!;
    f.browse();
    const browsing = f.session.navigate(root, visible);
    expect(L.paneOfView(browsing, 'page')?.id).toBe(L.paneOfView(root, 'history')?.id);
    expect(L.paneOfView(browsing, 'chapters')).toBe(hidden);
    expect(f.session.saved(browsing)).toEqual(root);
    f.session.allow(visible);
    expect(f.allow).toHaveBeenLastCalledWith(true, true);
  });

  it('cannot browse when the only companion is absent', () => {
    const f = fixture();
    const root = L.split('row', [L.pane(['player']), L.pane(['chapters'])]);
    const visible = L.removeView(root, 'chapters')!;
    expect(projectSessionLayout(root, true, visible)).toEqual({ layout: root, canBrowse: false });
    f.session.allow(visible);
    expect(f.allow).toHaveBeenLastCalledWith(false, true);
  });
});
