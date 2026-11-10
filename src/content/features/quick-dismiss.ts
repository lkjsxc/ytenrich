// One-click "Not interested" button, always visible, right before each recommendation's 3-dot menu.
import { toggleAttr } from '../../shared/dom.ts';
import { h, svg } from '../../shared/h.ts';
import { createDisposables } from '../../shared/signal.ts';
import { extractItem, menuHostOf } from '../../youtube/extract.ts';
import { clickNotInterested } from '../../youtube/menu.ts';
import type { Feature } from '../features.ts';
import type { RecoItem } from '../scanner.ts';

const BUTTON = 'ytenrich-dismiss';
const HOST = 'ytenrich-menu-host';
const GONE = 'ytenrich-dismissed'; // collapses an item right after a successful dismiss
const MAX_PENDING = 1000; // items whose menu has not rendered yet; oldest dropped beyond this
const MAX_GONE = 1000; // ids dismissed in this tab (kept collapsed if YouTube shows them again)
const HINT = 'Tell YouTube: Not interested';

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

    const gone = new Set<string>();
    const state = (btn: HTMLElement, value: '' | 'busy' | 'fail', title = HINT): void => {
      btn.setAttribute(BUTTON, value);
      btn.title = title;
    };
    const run = (root: Element, btn: HTMLElement): void => {
      busy.add(root);
      state(btn, 'busy');
      queue = queue.then(async () => {
        const info = extractItem(root);
        const r = await clickNotInterested(root, rt.settings.get().dismissLabel);
        if (!r.ok) {
          const menu = r.labels.length ? `menu: ${r.labels.join(' | ')}` : 'menu did not open';
          const why = `${r.reason} (${menu}). Signed out, or set the exact label in Settings.`;
          rt.log.write('warn', 'dismiss', `${info?.id ?? '?'}: ${why}`);
          state(btn, 'fail', `Failed: ${why}`);
          return;
        }
        state(btn, '');
        if (info) {
          gone.add(info.id);
          if (gone.size > MAX_GONE) gone.delete(gone.values().next().value as string);
          if (extractItem(root)?.id === info.id) root.setAttribute(GONE, '');
          if (rt.settings.get().statsEnabled)
            await rt.call('dismissed', { id: info.id }).catch(() => undefined);
        }
        rt.log.write('info', 'dismiss', `not interested: ${info?.title || info?.id}`);
      });
      queue = queue
        .catch((e: unknown) => {
          state(btn, 'fail', `Failed: ${String(e)}`);
          rt.log.write('warn', 'dismiss', String(e));
        })
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
        if (e.isTrusted && !busy.has(root)) run(root, e.currentTarget as HTMLElement);
      };
      host.setAttribute(HOST, '');
      host.prepend(h('button', { [BUTTON]: true, type: 'button', title: HINT, onclick }, icon()));
      return true;
    };

    d.add(
      rt.scanner.onItem((item: RecoItem) => {
        toggleAttr(item.el, GONE, gone.has(item.id)); // recycled elements show another video
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
