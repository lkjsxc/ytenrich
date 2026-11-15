import { afterEach, expect, it, vi } from 'vitest';
import { DEFAULT_SETTINGS } from '../src/shared/settings.ts';
import { createSignal } from '../src/shared/signal.ts';
import { emptyStat } from '../src/shared/stats-rules.ts';
import type { OpenRow } from '../src/shared/types.ts';
import { mountHistory } from '../src/views/history.ts';
import { openDate } from '../src/views/history-row.ts';
import type { ViewEnv } from '../src/views/registry.ts';

afterEach(() => {
  document.body.replaceChildren();
  vi.unstubAllGlobals();
});

it('renders separate opens, toggles only its own row, and retains expansion after refresh', async () => {
  let refresh = (): void => {};
  vi.stubGlobal('chrome', {
    storage: {
      onChanged: {
        addListener: (fn: (changes: object, area: string) => void) => {
          refresh = () => fn({ statsRev: {} }, 'local');
        },
        removeListener: vi.fn(),
      },
    },
  });
  const time = new Date(2026, 10, 15, 18, 30).getTime();
  const v = { ...emptyStat('video', time), title: 'Repeated video', opened: 5, openedAt: time };
  const rows: OpenRow[] = [
    { id: 'latest', video: v.id, time, row: v },
    { id: 'other', video: 'other', time: time - 1000, row: { ...v, id: 'other', opened: 1 } },
    { id: 'earlier', video: v.id, time: time - 86_400_000, row: v },
  ];
  const opens = [rows[0], rows[2], { id: 'unloaded', video: v.id, time: time - 172_800_000 }];
  const call = vi.fn(async (method: string) =>
    method === 'history' ? { rows, next: null } : opens,
  );
  const settings = createSignal({ ...DEFAULT_SETTINGS, thumbnailsEnabled: false });
  const tile = document.createElement('div');
  tile.className = 'body own';
  document.body.append(tile);
  const dispose = mountHistory(tile, { call, settings } as unknown as ViewEnv);
  await vi.waitFor(() => expect(tile.querySelectorAll('.hrow')).toHaveLength(3));
  const mark = tile.querySelector<HTMLButtonElement>('.hcount')!;
  const untouched = tile.querySelectorAll('.hrow')[1];
  tile.scrollTop = 80;
  mark.click();
  await vi.waitFor(() => expect(tile.querySelectorAll('.hopens button')).toHaveLength(3));
  expect(mark.getAttribute('aria-expanded')).toBe('true');
  expect(mark.textContent).toBe('×5');
  expect(tile.scrollTop).toBe(80);
  expect(tile.querySelectorAll('.hrow')[1]).toBe(untouched);
  const details = tile.querySelector<HTMLElement>('.hopens')!;
  expect(details.textContent).toContain('+ 2 earlier, time not recorded');
  const lines = details.querySelectorAll<HTMLButtonElement>('button');
  expect(lines[0]?.textContent).toBe(openDate(time));
  expect(lines[0]?.classList.contains('muted')).toBe(false);
  expect(lines[1]?.classList.contains('muted')).toBe(true);
  lines[2]!.click(); // the event isn't loaded: no movement
  expect(tile.scrollTop).toBe(80);
  const target = tile.querySelector<HTMLElement>('[data-open="earlier"]')!;
  vi.spyOn(target, 'getBoundingClientRect').mockReturnValue({ top: 200 } as DOMRect);
  lines[1]!.click();
  expect(tile.scrollTop).toBe(280);
  mark.click();
  expect(details.hidden).toBe(true);
  expect(tile.scrollTop).toBe(280);
  mark.click();
  rows[0] = { ...rows[0]!, row: { ...v, opened: 6 } };
  refresh();
  await vi.waitFor(() => expect(tile.querySelector('.hcount')?.textContent).toBe('×6'));
  expect(tile.querySelector('.hcount')?.getAttribute('aria-expanded')).toBe('true');
  expect(tile.querySelectorAll('.hrow')[1]).toBe(untouched);
  dispose();
});
