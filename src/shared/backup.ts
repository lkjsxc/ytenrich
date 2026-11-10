// Export / import of everything ytenrich keeps: settings, layouts, tab state and the stats DB, as one JSON file.
import { LAYOUT_PREFIX } from './layout-store.ts';
import type { call as Call } from './protocol.ts';
import { SETTINGS_KEY } from './settings.ts';
import type { StoreName } from './types.ts';

const APP = 'ytenrich';
const FORMAT = 1;
const STORES: readonly StoreName[] = ['videos', 'days', 'channels'];
const CHUNK = 2000; // rows per message, far below the browser's message size limit
const kept = (key: string): boolean =>
  key === SETTINGS_KEY || key.startsWith(LAYOUT_PREFIX) || key.startsWith('view:');

export type Backup = {
  app: typeof APP;
  format: number;
  exportedAt: string;
  storage: Record<string, unknown>;
  stats: Record<StoreName, unknown[]>;
};

export async function exportData(call: typeof Call): Promise<Backup> {
  const all = await chrome.storage.local.get(null);
  const stats: Backup['stats'] = { videos: [], days: [], channels: [] }; // bound: the DB's own caps
  for (const store of STORES) {
    for (let after: string | null = null, first = true; first || after !== null; first = false) {
      const page: { rows: unknown[]; next: string | null } = await call('dump', {
        store,
        after,
        limit: CHUNK,
      });
      stats[store].push(...page.rows);
      after = page.next;
    }
  }
  return {
    app: APP,
    format: FORMAT,
    exportedAt: new Date().toISOString(),
    storage: Object.fromEntries(Object.entries(all).filter(([k]) => kept(k))),
    stats,
  };
}

/** Replaces everything with the backup. Throws before touching anything if the file is not one. */
export async function importData(call: typeof Call, data: unknown): Promise<number> {
  const b = data as Partial<Backup> | null;
  if (typeof b !== 'object' || b === null || b.app !== APP || typeof b.stats !== 'object')
    throw new Error('This file is not a ytenrich export.');
  if (typeof b.format !== 'number' || b.format > FORMAT)
    throw new Error('This export comes from a newer ytenrich. Update the extension first.');
  const lists = STORES.map((s) => (Array.isArray(b.stats?.[s]) ? b.stats[s] : []));
  await call('clear', null);
  for (const [i, store] of STORES.entries()) {
    const rows = lists[i] ?? [];
    for (let at = 0; at < rows.length; at += CHUNK)
      await call('restore', { store, rows: rows.slice(at, at + CHUNK) });
  }
  const storage = typeof b.storage === 'object' && b.storage !== null ? b.storage : {};
  const old = Object.keys(await chrome.storage.local.get(null)).filter(kept);
  await chrome.storage.local.remove(old);
  await chrome.storage.local.set(
    Object.fromEntries(Object.entries(storage).filter(([k]) => kept(k))),
  );
  return lists.reduce((n, l) => n + l.length, 0);
}
