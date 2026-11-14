import { createSignal, type Signal } from '../shared/signal.ts';
import type { PageKind } from '../shared/types.ts';
import { NAV_EVENT, pageKind, pageVideoId } from '../youtube/route.ts';

export type Page = {
  readonly kind: PageKind;
  readonly url: string;
  readonly videoId: string | undefined;
  readonly nav: number;
};

/** `sync` re-reads the address: for a site that announces no finished navigation (YouTube Music). */
export function createRouteSignal(): { page: Signal<Page>; sync(): void; dispose(): void } {
  let nav = 0;
  const read = (): Page => {
    const url = new URL(location.href);
    return { kind: pageKind(url), url: url.href, videoId: pageVideoId(url), nav: ++nav };
  };
  const page = createSignal(read());
  const sync = (): void => {
    if (page.get().url !== location.href) page.set(read());
  };
  document.addEventListener(NAV_EVENT, sync);
  window.addEventListener('popstate', sync);
  return {
    page,
    sync,
    dispose() {
      document.removeEventListener(NAV_EVENT, sync);
      window.removeEventListener('popstate', sync);
    },
  };
}
