// Feature registry. A feature = folder in ./features exporting a Feature. Order matters only for item decoration.
import { createDisposables, type Disposer } from '../shared/signal.ts';
import { SITE } from '../youtube/site.ts';
import { collect } from './features/collect.ts';
import { details } from './features/details.ts';
import { hideOverexposed } from './features/hide-overexposed.ts';
import { musicStats } from './features/music-stats.ts';
import { quickDismiss } from './features/quick-dismiss.ts';
import { shorts } from './features/shorts.ts';
import { stats } from './features/stats.ts';
import { wm } from './features/wm.ts';
import type { Runtime } from './runtime.ts';

export type Feature = { readonly id: string; start(rt: Runtime): Disposer };

const YOUTUBE: readonly Feature[] = [
  shorts,
  hideOverexposed,
  stats,
  collect,
  quickDismiss,
  details,
  wm,
];
/** YouTube Music records qualified plays and tiles: every other feature reads youtube.com's recommendation tiles. */
export const FEATURES: readonly Feature[] = SITE === 'music' ? [musicStats, wm] : YOUTUBE;

export function startFeatures(rt: Runtime): Disposer {
  const all = createDisposables();
  for (const f of FEATURES) {
    try {
      all.add(f.start(rt));
    } catch (e) {
      rt.log.write('error', f.id, `start failed: ${String(e)}`);
    }
  }
  return all.dispose;
}
