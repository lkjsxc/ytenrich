// Content runtime: the shared context every feature and view receives.
import { createLog, type Log } from '../shared/log.ts';
import { call } from '../shared/protocol.ts';
import { DEFAULT_SETTINGS, loadSettings, onSettings, type Settings } from '../shared/settings.ts';
import { createSignal, type Signal } from '../shared/signal.ts';
import { pageChannel } from '../youtube/extract.ts';
import { SITE } from '../youtube/site.ts';
import { createRouteSignal, type Page } from './route-signal.ts';
import { createScanner, type Scanner } from './scanner.ts';

export type Runtime = {
  readonly settings: Signal<Settings>;
  readonly page: Signal<Page>;
  readonly scanner: Scanner;
  /** Name of the channel the page is about (watch owner, channel page), '' elsewhere or before it renders. */
  readonly channel: Signal<string>;
  readonly log: Log;
  readonly call: typeof call;
  /** Ids the hide feature currently suppresses (shared with views such as Shorts). */
  readonly suppressed: Set<string>;
  /** Running count of items the hide feature hid (once per navigation and id). */
  readonly hidden: Signal<number>;
  dispose(): void;
};

export function createRuntime(): Runtime {
  const settings = createSignal<Settings>(DEFAULT_SETTINGS);
  void loadSettings().then(settings.set);
  const offSettings = onSettings(settings.set);
  const route = createRouteSignal();
  const scanner = createScanner(route.page);
  const channel = createSignal('');
  const readChannel = (): void => channel.set(pageChannel(route.page.get().kind));
  const offChannel = [scanner.onTick(readChannel), route.page.subscribe(readChannel)];
  // YouTube Music fires no event when a navigation is done: its DOM changes are the cue to re-read the address.
  if (SITE === 'music') offChannel.push(scanner.onTick(route.sync));
  return {
    settings,
    page: route.page,
    scanner,
    channel,
    log: createLog(),
    call,
    hidden: createSignal(0),
    suppressed: new Set(), // bound: suppressed ids loaded from background (filtered by threshold)
    dispose() {
      for (const off of offChannel) off();
      offSettings();
      route.dispose();
      scanner.dispose();
    },
  };
}
