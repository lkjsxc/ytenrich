// Collector for the Recommended list. It takes every recommendation YouTube puts on the page, on screen or
// not, and while the background says the stock is low it lets YouTube's hidden lists load further pages.
import { toggleAttr } from '../../shared/dom.ts';
import { createDisposables } from '../../shared/signal.ts';
import type { Impression } from '../../shared/types.ts';
import { ageOf, avatarOf, channelOf } from '../../youtube/extract.ts';
import type { Feature } from '../features.ts';

const FLUSH_MS = 2000;
const MAX_BUFFER = 500; // offers buffered between flushes
const MAX_PER_PAGE = 300; // items one navigation may gather before loading more stops
const MIN_PER_PAGE = 80; // gathered from every page even when the stock is full, so each kind of page contributes
const HARVEST = 'ytenrich-harvest'; // youtube.css keeps hidden lists loading while this is set

export const collect: Feature = {
  id: 'collect',
  start(rt) {
    const d = createDisposables();
    let buffer: { item: Impression; el: Element }[] = [];
    let offered = new Set<string>(); // bound: ids of this navigation, MAX_PAGE_ITEMS in the scanner
    let timer: ReturnType<typeof setTimeout> | undefined;
    let want = true; // the background's last word on whether the stock is low

    const mode = (): string => {
      const s = rt.settings.get();
      return s.statsEnabled ? s.collect : 'shown';
    };
    const steer = (): void =>
      toggleAttr(
        document.documentElement,
        HARVEST,
        mode() === 'more' &&
          offered.size < (want ? MAX_PER_PAGE : MIN_PER_PAGE) &&
          !document.hidden,
      );
    const flush = (): void => {
      timer = undefined;
      // Avatars, the age line and a channel page's header render late, so they are read now, a moment after
      // the tile was found.
      const items = buffer.map(({ item, el }) => ({
        ...item,
        channel: item.channel || channelOf(el),
        age: ageOf(el),
        icon: avatarOf(el),
      }));
      buffer = [];
      if (!items.length || mode() === 'shown') return;
      rt.call('offer', { items }).then(
        (r) => {
          want = r.want;
          steer();
        },
        (e: unknown) => rt.log.write('warn', 'collect', `offer: ${String(e)}`),
      );
    };
    d.add(
      rt.scanner.onItem((item) => {
        if (mode() === 'shown' || offered.has(item.id) || buffer.length >= MAX_BUFFER) return;
        offered.add(item.id);
        const { id, kind, surface, title, channel, video } = item;
        buffer.push({ item: { id, kind, surface, title, channel, video }, el: item.el });
        timer ??= setTimeout(flush, FLUSH_MS);
        if (offered.size >= MIN_PER_PAGE) steer();
      }),
    );
    d.add(
      rt.page.subscribe(() => {
        offered = new Set();
        steer();
      }),
    );
    d.add(rt.settings.subscribe(steer));
    document.addEventListener('visibilitychange', steer);
    window.addEventListener('pagehide', flush);
    d.add(() => {
      document.removeEventListener('visibilitychange', steer);
      window.removeEventListener('pagehide', flush);
      clearTimeout(timer);
      flush();
      document.documentElement.removeAttribute(HARVEST);
    });
    steer();
    return d.dispose;
  },
};
