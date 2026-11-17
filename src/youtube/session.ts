// One retained YouTube playback session per document. Native YouTube owns the media, ads and navigation.
import type { Page } from '../content/route-signal.ts';
import type { Settings } from '../shared/settings.ts';
import { createSignal, type Signal } from '../shared/signal.ts';
import { NAV_EVENT } from './route.ts';
import {
  miniMedia,
  minimizeForNavigation,
  onSessionNavigation,
  sessionMedia,
  stopSessionPlayer,
  watchIdentity,
} from './session-dom.ts';
import { SITE } from './site.ts';

export type Playback = {
  readonly kept: Signal<string | undefined>;
  /** Whether the current layout has room for Page beside Player, without moving any divider. */
  allow(value: boolean, hasPlayer?: boolean): void;
  close(): void;
  continued(nav: number): boolean;
  dispose(): void;
};

export function createPlayback(
  settings: Signal<Settings>,
  page: Signal<Page>,
  ticks: (fn: () => void) => () => void,
): Playback {
  const kept = createSignal<string | undefined>(undefined);
  let room = false;
  let present = false;
  let media: HTMLVideoElement | null = null; // bound: the one retained media element
  let closed: string | undefined;
  let continuedNav = 0;
  let settled = false;
  let frame = 0;
  const enabled = (): boolean =>
    SITE === 'youtube' && settings.get().wmEnabled && settings.get().sessionPlayback;
  const ready = (): void =>
    void document.documentElement.toggleAttribute(
      'ytenrich-session-ready',
      enabled() && room && page.get().kind === 'watch' && !closed,
    );
  const clear = (): void => {
    media = null;
    settled = false;
    kept.set(undefined);
  };
  const close = (): void => {
    closed = watchIdentity();
    stopSessionPlayer();
    clear();
    ready();
  };
  const offKept = kept.subscribe((id) =>
    document.documentElement.toggleAttribute('ytenrich-session', Boolean(id)),
  );
  const confirm = (): void => {
    if (kept.get() && settled && page.get().kind !== 'watch' && miniMedia() !== media) close();
  };
  const finish = (): void => {
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(() => {
      frame = 0;
      settled = true;
      confirm();
    });
  };
  const offNav =
    SITE === 'youtube'
      ? onSessionNavigation((kind) => {
          if (kept.get()) {
            settled = false;
            cancelAnimationFrame(frame);
            frame = 0;
          }
          if (kind === 'shorts') {
            if (kept.get()) close();
            return;
          }
          if (kind === 'watch' || kept.get() || !enabled() || !room || document.fullscreenElement)
            return;
          const id = watchIdentity();
          const current = sessionMedia();
          if (!id || id === closed || !current?.currentSrc || current.ended) return;
          media = current;
          settled = false;
          kept.set(id);
          if (miniMedia() !== current) minimizeForNavigation();
        })
      : () => {};
  const offPage = page.subscribe((next) => {
    if (next.kind === 'watch') {
      if (kept.get() === next.videoId && media === sessionMedia() && !media?.ended)
        continuedNav = next.nav;
      closed = undefined;
      clear();
    } else if (next.kind === 'shorts' && kept.get()) close();
    ready();
  });
  const offSettings = settings.subscribe(() => {
    ready();
    if (!enabled() && kept.get()) close();
  });
  const offTicks = SITE === 'youtube' ? ticks(confirm) : () => {};
  document.addEventListener(NAV_EVENT, finish);
  return {
    kept,
    allow(value, hasPlayer = true) {
      room = value;
      present = hasPlayer;
      ready();
      if ((!room || !present) && kept.get())
        queueMicrotask(() => {
          if ((!room || !present) && kept.get()) close();
        });
    },
    close,
    continued: (nav) => continuedNav === nav,
    dispose() {
      offNav();
      offPage();
      offSettings();
      offTicks();
      offKept();
      document.removeEventListener(NAV_EVENT, finish);
      cancelAnimationFrame(frame);
      document.documentElement.removeAttribute('ytenrich-session');
      document.documentElement.removeAttribute('ytenrich-session-ready');
    },
  };
}
