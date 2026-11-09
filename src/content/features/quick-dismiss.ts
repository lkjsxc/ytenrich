// One-click "Not interested" button on every recommendation thumbnail.
import { h } from '../../shared/h.ts';
import { createDisposables } from '../../shared/signal.ts';
import { extractItem, thumbOf } from '../../youtube/extract.ts';
import { clickNotInterested } from '../../youtube/menu.ts';
import type { Feature } from '../features.ts';

const BUTTON = 'ytenrich-dismiss';

export const quickDismiss: Feature = {
  id: 'dismiss',
  start(rt) {
    const d = createDisposables();
    let queue = Promise.resolve();

    const run = (root: Element): void => {
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
        if (info) await rt.call('dismissed', { id: info.id }).catch(() => undefined);
        rt.log.write('info', 'dismiss', `not interested: ${info?.title ?? info?.id}`);
      });
    };

    d.add(
      rt.scanner.onItem((item) => {
        if (!rt.settings.get().dismissEnabled) return;
        const thumb = thumbOf(item.el);
        if (thumb.querySelector(`:scope > [${BUTTON}]`)) return;
        const onclick = (e: Event): void => {
          e.preventDefault();
          e.stopPropagation();
          run(item.el);
        };
        thumb.appendChild(
          h(
            'button',
            { [BUTTON]: true, type: 'button', title: 'Not interested (ytenrich)', onclick },
            '✕',
          ),
        );
      }),
    );
    const toggle = (on: boolean): void => {
      document.documentElement.toggleAttribute('ytenrich-no-dismiss', !on);
    };
    toggle(rt.settings.get().dismissEnabled);
    d.add(rt.settings.subscribe((s) => toggle(s.dismissEnabled)));
    return d.dispose;
  },
};
