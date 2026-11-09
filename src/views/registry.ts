// View registry: every tab a WM pane (or the options page) can show.

import type { Scanner } from '../content/scanner.ts';
import type { Log } from '../shared/log.ts';
import type { call } from '../shared/protocol.ts';
import type { Settings } from '../shared/settings.ts';
import type { Disposer, Signal } from '../shared/signal.ts';
import type { WatchSlot } from '../youtube/selectors.ts';
import { mountLog } from './log.ts';
import { mountSettings } from './settings.ts';
import { mountShorts } from './shorts.ts';
import { mountStats } from './stats.ts';

export type ViewEnv = {
  readonly call: typeof call;
  readonly log: Log;
  readonly settings: Signal<Settings>;
  readonly scanner?: Scanner;
  readonly suppressed?: ReadonlySet<string>;
};
export type ViewDef = {
  readonly id: string;
  readonly title: string;
  /** Native YouTube element projected into the pane (content script only). */
  readonly slot?: WatchSlot;
  /** Own view rendered by ytenrich into the pane body. */
  readonly mount?: (el: HTMLElement, env: ViewEnv) => Disposer;
  readonly needsScanner?: boolean;
};

export const VIEWS: readonly ViewDef[] = [
  { id: 'guide', title: 'Guide', slot: 'guide' },
  { id: 'player', title: 'Player', slot: 'player' },
  { id: 'details', title: 'Details', slot: 'details' },
  { id: 'comments', title: 'Comments', slot: 'comments' },
  { id: 'chat', title: 'Chat', slot: 'chat' },
  { id: 'videos', title: 'Videos', slot: 'videos' },
  { id: 'shorts', title: 'Shorts', mount: mountShorts, needsScanner: true },
  { id: 'stats', title: 'Stats', mount: mountStats },
  { id: 'settings', title: 'Settings', mount: mountSettings },
  { id: 'log', title: 'Log', mount: mountLog },
];

export const VIEW_BY_ID: ReadonlyMap<string, ViewDef> = new Map(VIEWS.map((v) => [v.id, v]));
