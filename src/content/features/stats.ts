// Impression recording (seen once per navigation), "opened" tracking, and per-thumbnail count badges.
import { toggleAttr } from '../../shared/dom.ts';
import { createDisposables } from '../../shared/signal.ts';
import type { Impression, Kind } from '../../shared/types.ts';
import { thumbOf } from '../../youtube/extract.ts';
import type { Feature } from '../features.ts';
import type { RecoItem } from '../scanner.ts';

const FLUSH_MS = 2000;
const MAX_BUFFER = 500; // impressions buffered between flushes
const RECENT_MAX = 1000; // id -> metadata cache for "opened" titles

export const stats: Feature = {
  id: 'stats',
  start(rt) {
    const d = createDisposables();
    let buffer: Impression[] = [];
    let timer: ReturnType<typeof setTimeout> | undefined;
    const recent = new Map<string, { title: string; channel: string; kind: Kind }>();

    const flush = (): void => {
      timer = undefined;
      if (!buffer.length) return;
      const items = buffer;
      buffer = [];
      rt.call('record', { items }).then(
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
    window.addEventListener('pagehide', flush);
    d.add(() => window.removeEventListener('pagehide', flush));

    const opened = (): void => {
      const { videoId, kind } = rt.page.get();
      if (!videoId || !rt.settings.get().statsEnabled) return;
      const meta = recent.get(videoId);
      const req = {
        id: videoId,
        kind: kind === 'shorts' ? 'short' : 'video',
        title: meta?.title ?? '',
        channel: meta?.channel ?? '',
      } as const;
      rt.suppressed.delete(videoId);
      rt.call('opened', req).catch((e: unknown) =>
        rt.log.write('warn', 'stats', `opened: ${String(e)}`),
      );
    };
    opened();
    d.add(rt.page.subscribe(opened));

    // Badges: batch count lookups per 100ms.
    let pending = new Map<string, RecoItem[]>();
    let badgeTimer: ReturnType<typeof setTimeout> | undefined;
    const lookup = (): void => {
      badgeTimer = undefined;
      const batch = pending;
      pending = new Map();
      rt.call('counts', { ids: [...batch.keys()] }).then(
        (counts) => {
          for (const [id, items] of batch) {
            const n = counts[id] ?? 0;
            for (const it of items)
              toggleAttr(
                thumbOf(it.el),
                'ytenrich-count',
                n > 0 && it.anchor.isConnected,
                String(n),
              );
          }
        },
        () => undefined,
      );
    };
    d.add(
      rt.scanner.onItem((item) => {
        if (!rt.settings.get().badgeEnabled) return;
        pending.set(item.id, [...(pending.get(item.id) ?? []), item]);
        badgeTimer ??= setTimeout(lookup, 100);
      }),
    );
    d.add(() => {
      clearTimeout(timer);
      clearTimeout(badgeTimer);
      flush();
    });
    return d.dispose;
  },
};
