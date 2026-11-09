// Content runtime: the shared context every feature and view receives.
import { createLog, type Log } from '../shared/log.ts';
import { call } from '../shared/protocol.ts';
import { DEFAULT_SETTINGS, loadSettings, onSettings, type Settings } from '../shared/settings.ts';
import { createSignal, type Signal } from '../shared/signal.ts';
import { createRouteSignal, type Page } from './route-signal.ts';
import { createScanner, type Scanner } from './scanner.ts';

export type Runtime = {
  readonly settings: Signal<Settings>;
  readonly page: Signal<Page>;
  readonly scanner: Scanner;
  readonly log: Log;
  readonly call: typeof call;
  /** Ids the hide feature currently suppresses (shared with views such as Shorts). */
  readonly suppressed: Set<string>;
  dispose(): void;
};

export function createRuntime(): Runtime {
  const settings = createSignal<Settings>(DEFAULT_SETTINGS);
  void loadSettings().then(settings.set);
  const offSettings = onSettings(settings.set);
  const route = createRouteSignal();
  const scanner = createScanner(route.page, createSignal(0));
  return {
    settings,
    page: route.page,
    scanner,
    log: createLog(),
    call,
    suppressed: new Set(), // bound: suppressed ids loaded from background (filtered by threshold)
    dispose() {
      offSettings();
      route.dispose();
      scanner.dispose();
    },
  };
}
