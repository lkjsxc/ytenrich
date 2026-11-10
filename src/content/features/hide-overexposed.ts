// Hide (or dim) recommendations seen >= threshold times that were never opened.
import { toggleAttr } from '../../shared/dom.ts';
import { createDisposables } from '../../shared/signal.ts';
import type { Feature } from '../features.ts';
import type { RecoItem } from '../scanner.ts';

export const hideOverexposed: Feature = {
  id: 'hide',
  start(rt) {
    const d = createDisposables();
    let counted = new Set<string>(); // ids hidden in this navigation (bounded by its items)
    d.add(rt.page.subscribe(() => (counted = new Set())));
    const apply = (item: RecoItem): void => {
      const mode = rt.settings.get().hideMode;
      const hit = mode !== 'off' && rt.suppressed.has(item.id);
      if (hit && mode === 'hide' && !counted.has(item.id)) {
        counted.add(item.id);
        rt.hidden.update((n) => n + 1);
      }
      toggleAttr(item.el, 'ytenrich-hidden', hit && mode === 'hide');
      toggleAttr(item.el, 'ytenrich-dim', hit && mode === 'dim');
    };
    const applyAll = (): void => {
      for (const item of rt.scanner.pageItems().values()) apply(item);
    };
    const refresh = (): void => {
      rt.call('suppressed', null).then(
        (ids) => {
          rt.suppressed.clear();
          for (const id of ids) rt.suppressed.add(id);
          applyAll();
        },
        (e: unknown) => rt.log.write('warn', 'hide', `load suppressed: ${String(e)}`),
      );
    };
    refresh();
    let { hideThreshold, hideMode } = rt.settings.get();
    d.add(
      rt.settings.subscribe((s) => {
        if (s.hideThreshold !== hideThreshold) setTimeout(refresh, 300);
        if (s.hideMode !== hideMode) applyAll();
        ({ hideThreshold, hideMode } = s);
      }),
    );
    d.add(rt.scanner.onItem(apply));
    return d.dispose;
  },
};
