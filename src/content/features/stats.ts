// Impression recording (seen once per navigation) and "opened" tracking.
import { createDisposables } from '../../shared/signal.ts';
import type { Impression, Kind } from '../../shared/types.ts';
import type { Feature } from '../features.ts';

const FLUSH_MS = 2000;
const MAX_BUFFER = 500; // impressions buffered between flushes
const RECENT_MAX = 1000; // id -> metadata cache for "opened" titles

export const stats: Feature = {
  id: 'stats',
  start(rt) {
    const d = createDisposables();
    let buffer: Impression[] = [];
    let timer: ReturnType<typeof setTimeout> | undefined;
    let hides = 0; // over-exposed items hidden since the last flush
    const recent = new Map<string, { title: string; channel: string; kind: Kind }>();

    const flush = (): void => {
      timer = undefined;
      const items = buffer;
      const hidden = hides;
      buffer = [];
      hides = 0;
      if ((!items.length && !hidden) || !rt.settings.get().statsEnabled) return;
      rt.call('record', { items, hidden }).then(
        (r) => r.suppressed.forEach((id) => rt.suppressed.add(id)),
        (e: unknown) => rt.log.write('warn', 'stats', `record: ${String(e)}`),
      );
    };
    d.add(
      rt.scanner.onSeen((item) => {
        recent.delete(item.id);
        recent.set(item.id, item);
        if (recent.size > RECENT_MAX) recent.delete(recent.keys().next().value as string);
        if (!rt.settings.get().statsEnabled || buffer.length >= MAX_BUFFER) return;
        buffer.push({
          id: item.id,
          kind: item.kind,
          surface: item.surface,
          title: item.title,
          channel: item.channel,
        });
        timer ??= setTimeout(flush, FLUSH_MS);
      }),
    );
    d.add(
      rt.hidden.subscribe(() => {
        if (!rt.settings.get().statsEnabled) return;
        hides++;
        timer ??= setTimeout(flush, FLUSH_MS);
      }),
    );
    window.addEventListener('pagehide', flush);
    d.add(() => window.removeEventListener('pagehide', flush));

    // A video opened without a prior recommendation has no known title: take it from the document title,
    // which YouTube sets shortly after navigation ("(3) Title - YouTube").
    let titleMo: MutationObserver | undefined;
    const describeLater = (id: string): void => {
      titleMo?.disconnect();
      const read = (): boolean => {
        const title = document.title.replace(/^\(\d+\)\s*/, '').replace(/\s*-\s*YouTube$/, '');
        if (!title || title === 'YouTube' || rt.page.get().videoId !== id) return false;
        void rt.call('describe', { id, title: title.slice(0, 200) }).catch(() => undefined);
        return true;
      };
      titleMo = new MutationObserver(() => {
        if (rt.page.get().videoId !== id || read()) titleMo?.disconnect();
      });
      titleMo.observe(document.head, { childList: true, subtree: true, characterData: true });
    };
    d.add(() => titleMo?.disconnect());

    let lastOpenedNav = 0;
    const opened = (): void => {
      const { videoId, kind, nav } = rt.page.get();
      if (!videoId || !rt.settings.get().statsEnabled || nav === lastOpenedNav) return;
      lastOpenedNav = nav;
      const meta = recent.get(videoId);
      const req = {
        id: videoId,
        kind: kind === 'shorts' ? 'short' : 'video',
        title: meta?.title ?? '',
        channel: meta?.channel ?? '',
      } as const;
      rt.suppressed.delete(videoId);
      if (!req.title) describeLater(videoId);
      rt.call('opened', req).catch((e: unknown) =>
        rt.log.write('warn', 'stats', `opened: ${String(e)}`),
      );
    };
    opened();
    d.add(rt.page.subscribe(opened));
    d.add(
      rt.settings.subscribe((settings) => {
        if (settings.statsEnabled) opened();
        else (buffer = []), (hides = 0);
      }),
    );

    d.add(() => {
      clearTimeout(timer);
      flush();
    });
    return d.dispose;
  },
};
