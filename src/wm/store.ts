// Everything the WM keeps in storage (`layout:*`: the layouts, and each family's workspace), mirrored in memory.
// A controller therefore starts on its saved layout at once, and switching workspaces never draws a default first.
import { LAYOUT_PREFIX, layoutKey } from '../shared/layout-store.ts';
import type { Space } from './spaces.ts';

const SAVE_MS = 400; // a layout changes continuously during a drag

export type WmStore = {
  /** Resolves once the stored values are in memory. */
  readonly ready: Promise<void>;
  get(key: string): unknown;
  /** Kept at once, written a moment later. */
  save(key: string, value: unknown): void;
  space(family: string, index: number): Space;
  dispose(): void;
};

export function createWmStore(): WmStore {
  // Bounds of the four maps: one entry per `layout:*` key (families × (workspaces + 1)).
  const values = new Map<string, unknown>();
  const timers = new Map<string, ReturnType<typeof setTimeout>>();
  const written = new Map<string, string>(); // our last write per key, to tell its echo from a foreign change
  const watchers = new Map<string, (value: unknown) => void>();

  const write = (key: string): void => {
    clearTimeout(timers.get(key));
    timers.delete(key);
    written.set(key, JSON.stringify(values.get(key)));
    void chrome.storage.local.set({ [key]: values.get(key) });
  };
  const flush = (): void => [...timers.keys()].forEach(write);
  const save = (key: string, value: unknown): void => {
    values.set(key, value);
    clearTimeout(timers.get(key));
    timers.set(
      key,
      setTimeout(() => write(key), SAVE_MS),
    );
  };
  const onChanged = (changes: Record<string, chrome.storage.StorageChange>, area: string): void => {
    for (const [key, c] of area === 'local' ? Object.entries(changes) : []) {
      const echo = written.has(key) && JSON.stringify(c.newValue) === written.get(key);
      if (!key.startsWith(LAYOUT_PREFIX) || echo) continue;
      clearTimeout(timers.get(key)); // a foreign change wins over ours still pending
      timers.delete(key);
      written.delete(key);
      if (c.newValue === undefined) values.delete(key);
      else values.set(key, c.newValue);
      watchers.get(key)?.(c.newValue);
    }
  };
  chrome.storage.onChanged.addListener(onChanged);
  window.addEventListener('pagehide', flush);
  const ready = chrome.storage.local.get(null).then((all) => {
    for (const [key, value] of Object.entries(all))
      if (key.startsWith(LAYOUT_PREFIX) && !values.has(key)) values.set(key, value);
  });

  return {
    ready,
    get: (key) => values.get(key),
    save,
    space(family, index) {
      const key = layoutKey(family, index);
      return {
        index,
        stored: values.get(key),
        save: (layout) => save(key, layout),
        watch(fn) {
          watchers.set(key, fn);
          return () => void (watchers.get(key) === fn && watchers.delete(key));
        },
      };
    },
    dispose() {
      flush();
      chrome.storage.onChanged.removeListener(onChanged);
      window.removeEventListener('pagehide', flush);
    },
  };
}
