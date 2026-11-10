// View registry: every tab a WM pane (or the options page) can show.

import type { Scanner } from '../content/scanner.ts';
import type { Log } from '../shared/log.ts';
import type { call } from '../shared/protocol.ts';
import type { Settings } from '../shared/settings.ts';
import type { Disposer, Signal } from '../shared/signal.ts';
import type { WmFamily } from '../shared/types.ts';
import type { NativeSlot } from '../youtube/selectors.ts';
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
  readonly slot?: NativeSlot;
  /** Layout families the view exists in (default: all). */
  readonly families?: readonly WmFamily[];
  /** Own view rendered by ytenrich into the pane body. */
  readonly mount?: (el: HTMLElement, env: ViewEnv) => Disposer;
  readonly needsScanner?: boolean;
};

const W: readonly WmFamily[] = ['watch'];

export const VIEWS: readonly ViewDef[] = [
  { id: 'guide', title: 'Guide', slot: 'guide' },
  { id: 'page', title: 'Page', slot: 'page', families: ['browse'] },
  { id: 'player', title: 'Player', slot: 'player', families: W },
  { id: 'details', title: 'Details', slot: 'details', families: W },
  { id: 'comments', title: 'Comments', slot: 'comments', families: W },
  { id: 'chat', title: 'Chat', slot: 'chat', families: W },
  { id: 'videos', title: 'Videos', slot: 'videos', families: W },
  { id: 'shorts', title: 'Shorts', mount: mountShorts, needsScanner: true },
  { id: 'stats', title: 'Stats', mount: mountStats },
  { id: 'settings', title: 'Settings', mount: mountSettings },
  { id: 'log', title: 'Log', mount: mountLog },
];

export const VIEW_BY_ID: ReadonlyMap<string, ViewDef> = new Map(VIEWS.map((v) => [v.id, v]));
export const viewsOf = (family: WmFamily): ViewDef[] =>
  VIEWS.filter((v) => !v.families || v.families.includes(family));
