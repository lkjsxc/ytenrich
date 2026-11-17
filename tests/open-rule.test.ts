import { expect, it, vi } from 'vitest';
import { stats } from '../src/content/features/stats.ts';
import type { Page } from '../src/content/route-signal.ts';
import type { Runtime } from '../src/content/runtime.ts';
import type { RecoItem } from '../src/content/scanner.ts';
import { DEFAULT_SETTINGS } from '../src/shared/settings.ts';
import { createSignal } from '../src/shared/signal.ts';

it('counts once per navigation while enabled, return visits again, and redirected Shorts only at watch', () => {
  const page = createSignal({
    videoId: 'video',
    kind: 'watch',
    nav: 1,
    url: 'https://www.youtube.com/watch?v=video',
  });
  const settings = createSignal({ ...DEFAULT_SETTINGS });
  const call = vi.fn(async () => null);
  const dispose = stats.start({
    page,
    settings,
    playback: { continued: () => false },
    call,
    hidden: createSignal(0),
    suppressed: new Set(),
    scanner: { onSeen: () => () => {} },
    log: { write: vi.fn() },
  } as unknown as Runtime);
  expect(call.mock.calls).toHaveLength(1);
  page.update((p) => ({ ...p }));
  settings.update((s) => ({ ...s }));
  expect(call.mock.calls).toHaveLength(1);
  page.update((p) => ({ ...p, nav: 2 }));
  expect(call.mock.calls).toHaveLength(2);
  settings.update((s) => ({ ...s, statsEnabled: false }));
  page.update((p) => ({ ...p, nav: 3 }));
  expect(call.mock.calls).toHaveLength(2);
  settings.update((s) => ({ ...s, statsEnabled: true }));
  expect(call.mock.calls).toHaveLength(3);
  page.update((p) => ({ ...p, nav: 4, kind: 'shorts' }));
  expect(call.mock.calls).toHaveLength(3);
  page.update((p) => ({ ...p, nav: 5, kind: 'watch' }));
  expect(call.mock.calls).toHaveLength(4);
  dispose();
});

const sessionFixture = () => {
  const page = createSignal<Page>({
    videoId: 'video',
    kind: 'watch',
    nav: 1,
    url: 'https://www.youtube.com/watch?v=video',
  });
  const settings = createSignal({ ...DEFAULT_SETTINGS });
  const call = vi.fn(async (_type: string, _req: unknown) => ({ suppressed: [] }));
  let continuedNav = 0;
  let seen: (item: RecoItem) => void = () => {};
  const dispose = stats.start({
    page,
    settings,
    call,
    playback: { continued: (nav: number) => nav === continuedNav },
    hidden: createSignal(0),
    suppressed: new Set(),
    log: { write: vi.fn() },
    scanner: {
      onSeen: (fn: (item: RecoItem) => void) => {
        seen = fn;
        return () => {};
      },
    },
  } as unknown as Runtime);
  const navigate = (url: string, videoId?: string, continued = false): void => {
    const nav = page.get().nav + 1;
    continuedNav = continued ? nav : 0;
    page.set({ nav, url, videoId, kind: videoId ? 'watch' : 'home' });
  };
  return {
    page,
    settings,
    dispose,
    navigate,
    opened: () =>
      call.mock.calls
        .filter(([type]) => type === 'opened')
        .map(([, req]) => (req as { id: string }).id),
    see: (item: RecoItem) => seen(item),
  };
};

it('keeps one open through browse pages and the return to the same playing video', () => {
  const f = sessionFixture();
  expect(f.opened()).toEqual(['video']);
  for (const path of ['/', '/results?search_query=music', '/@YouTube'])
    f.navigate(`https://www.youtube.com${path}`);
  expect(f.opened()).toEqual(['video']);
  f.navigate('https://www.youtube.com/watch?v=video', 'video', true);
  expect(f.opened()).toEqual(['video']);
  // Revisiting the same route notification or enabling stats again cannot resurrect this return.
  f.page.update((p) => ({ ...p }));
  f.settings.update((s) => ({ ...s, statsEnabled: false }));
  f.settings.update((s) => ({ ...s, statsEnabled: true }));
  expect(f.opened()).toEqual(['video']);
  f.navigate('https://www.youtube.com/watch?v=next', 'next');
  expect(f.opened()).toEqual(['video', 'next']);
  f.dispose();
});

it('counts genuine repeated opens after closing the session or loading a fresh document', () => {
  const f = sessionFixture();
  f.navigate('https://www.youtube.com/');
  f.navigate('https://www.youtube.com/watch?v=video', 'video'); // the kept player was closed
  expect(f.opened()).toEqual(['video', 'video']);
  f.dispose();
  const reloaded = sessionFixture();
  expect(reloaded.opened()).toEqual(['video']);
  reloaded.dispose();
});

it('still counts a newly opened known Mix once when its video continues', () => {
  const f = sessionFixture();
  const anchor = document.createElement('a');
  f.see({
    el: anchor,
    anchor,
    id: 'RDmix',
    kind: 'mix',
    surface: 'home',
    title: 'Mix',
    channel: 'Channel',
    video: 'video',
  });
  f.navigate('https://www.youtube.com/');
  f.navigate('https://www.youtube.com/watch?v=video&list=RDmix', 'video', true);
  expect(f.opened()).toEqual(['video', 'RDmix']);
  f.navigate('https://www.youtube.com/');
  f.navigate('https://www.youtube.com/watch?v=video&list=RDmix', 'video', true);
  expect(f.opened()).toEqual(['video', 'RDmix']);
  f.dispose();
});
