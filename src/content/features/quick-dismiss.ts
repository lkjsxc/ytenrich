// One-click "Not interested" button, always visible, right before each recommendation's 3-dot menu.
import { h, svg } from '../../shared/h.ts';
import { createDisposables } from '../../shared/signal.ts';
import { extractItem, menuHostOf } from '../../youtube/extract.ts';
import { clickNotInterested } from '../../youtube/menu.ts';
import type { Feature } from '../features.ts';
import type { RecoItem } from '../scanner.ts';

const BUTTON = 'ytenrich-dismiss';
const HOST = 'ytenrich-menu-host';
const MAX_PENDING = 1000; // items whose menu has not rendered yet; oldest dropped beyond this

const icon = (): SVGElement =>
  svg(
    'svg',
    { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': 2 },
    svg('circle', { cx: 12, cy: 12, r: 8.5 }),
    svg('path', { d: 'M6 6l12 12' }),
  );

export const quickDismiss: Feature = {
  id: 'dismiss',
  start(rt) {
    const d = createDisposables();
    let queue = Promise.resolve();
    const pending = new Set<Element>();
    const busy = new WeakSet<Element>(); // items with a dismiss in flight (double-click guard)

    const run = (root: Element): void => {
      busy.add(root);
      queue = queue.then(async () => {
        const info = extractItem(root);
        const result = await clickNotInterested(root, rt.settings.get().dismissLabel);
        if (result !== 'ok') {
          rt.log.write(
            'warn',
            'dismiss',
            `${result} for ${info?.id ?? '?'} (signed out, or label missing: set it in Settings)`,
          );
          return;
        }
        if (info && rt.settings.get().statsEnabled)
          await rt.call('dismissed', { id: info.id }).catch(() => undefined);
        rt.log.write('info', 'dismiss', `not interested: ${info?.title ?? info?.id}`);
      });
      queue = queue
        .catch((e: unknown) => rt.log.write('warn', 'dismiss', String(e)))
        .finally(() => busy.delete(root));
    };

    /** Returns false while the item's menu is not rendered yet. */
    const attach = (root: Element): boolean => {
      const host = menuHostOf(root);
      if (!host) return false;
      if (host.querySelector(`:scope > [${BUTTON}]`)) return true;
      const onclick = (e: Event): void => {
        e.preventDefault();
        e.stopPropagation();
        if (e.isTrusted && !busy.has(root)) run(root);
      };
      host.setAttribute(HOST, '');
      host.prepend(
        h(
          'button',
          { [BUTTON]: true, type: 'button', title: 'Tell YouTube: Not interested', onclick },
          icon(),
        ),
      );
      return true;
    };

    d.add(
      rt.scanner.onItem((item: RecoItem) => {
        if (!rt.settings.get().dismissEnabled || attach(item.el)) return;
        pending.add(item.el);
        if (pending.size > MAX_PENDING) pending.delete(pending.values().next().value as Element);
      }),
    );
    d.add(
      rt.scanner.onTick(() => {
        for (const el of pending) if (!el.isConnected || attach(el)) pending.delete(el);
      }),
    );
    d.add(() => pending.clear());
    const toggle = (on: boolean): void => {
      document.documentElement.toggleAttribute('ytenrich-no-dismiss', !on);
    };
    toggle(rt.settings.get().dismissEnabled);
    d.add(rt.settings.subscribe((s) => toggle(s.dismissEnabled)));
    return d.dispose;
  },
};
