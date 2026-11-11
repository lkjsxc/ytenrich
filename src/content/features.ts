// Feature registry. A feature = folder in ./features exporting a Feature. Order matters only for item decoration.
import { createDisposables, type Disposer } from '../shared/signal.ts';
import { collect } from './features/collect.ts';
import { hideOverexposed } from './features/hide-overexposed.ts';
import { quickDismiss } from './features/quick-dismiss.ts';
import { stats } from './features/stats.ts';
import { wm } from './features/wm.ts';
import type { Runtime } from './runtime.ts';

export type Feature = { readonly id: string; start(rt: Runtime): Disposer };

export const FEATURES: readonly Feature[] = [hideOverexposed, stats, collect, quickDismiss, wm];

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
