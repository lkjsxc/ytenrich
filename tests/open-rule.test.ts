import { expect, it, vi } from 'vitest';
import { stats } from '../src/content/features/stats.ts';
import type { Runtime } from '../src/content/runtime.ts';
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
