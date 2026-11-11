// Background: owns the stats DB and answers typed protocol messages.
import {
  type Api,
  type Message,
  type Method,
  type Reply,
  STATS_REV_KEY,
} from '../shared/protocol.ts';
import { DEFAULT_SETTINGS, loadSettings, onSettings, type Settings } from '../shared/settings.ts';
import * as backup from './backup.ts';
import { recommend, touch, wanted } from './recommend.ts';
import * as read from './stats-read.ts';
import * as repo from './stats-repo.ts';
import { judge, suppressedIds } from './suppress.ts';

// The welcome page says what is recorded and holds the switch. It opens on install, and once on the update
// that turned stats on by default (versions are one counter: 0.2.5 reads as 205).
const STATS_ON_SINCE = 206;
const counter = (v = ''): number =>
  v.split('.').reduce((n, part) => n * 100 + Number(part), 0) % 1e6;
chrome.runtime.onInstalled.addListener(({ reason, previousVersion }) => {
  if (reason === 'install' || (reason === 'update' && counter(previousVersion) < STATS_ON_SINCE))
    void chrome.tabs.create({ url: chrome.runtime.getURL('options.html#welcome') });
});

// With hiding off nothing counts as over-exposed, so nothing is held back from Recommended either.
const thresholdOf = (s: Settings): number => (s.hideMode === 'off' ? Infinity : s.hideThreshold);
let threshold = thresholdOf(DEFAULT_SETTINGS);
void loadSettings().then((s) => (threshold = thresholdOf(s)));
onSettings((s) => {
  threshold = thresholdOf(s);
  touch();
});

const PRUNE_EVERY = 2000; // recorded items between prune passes
let sincePrune = 0;
const countForPrune = (n: number): void => {
  sincePrune += n;
  if (sincePrune <= PRUNE_EVERY) return;
  sincePrune = 0;
  void repo.prune();
};

const REV_MS = 1500; // at most one stats-changed broadcast per window (trailing)
let revTimer: ReturnType<typeof setTimeout> | undefined;
const bumpRev = (): void => {
  if (revTimer) return;
  revTimer = setTimeout(() => {
    revTimer = undefined;
    void chrome.storage.local.set({ [STATS_REV_KEY]: Date.now() });
  }, REV_MS);
};
const MUTATING: ReadonlySet<Method> = new Set([
  'record',
  'offer',
  'opened',
  'describe',
  'dismissed',
  'clear',
  'restore',
]);

type Handlers = { [K in Method]: (req: Api[K]['req']) => Promise<Api[K]['res']> };
const handlers: Handlers = {
  async record({ items, hidden }) {
    countForPrune(items.length);
    return { suppressed: await repo.record(items, hidden, threshold) };
  },
  async offer({ items }) {
    countForPrune(items.length);
    await repo.offer(items);
    return { want: await wanted(await judge(threshold)) };
  },
  opened: (req) => repo.opened(req).then(() => null),
  describe: ({ id, title }) => repo.describe(id, title).then(() => null),
  dismissed: ({ id }) => repo.dismissed(id).then(() => null),
  suppressed: async () => [...(await suppressedIds(threshold))],
  query: (q) => read.query(q, threshold),
  recommend: async ({ mode, limit }) => recommend(mode, limit, await judge(threshold)),
  overview: () => read.overview(threshold),
  channels: ({ sort, limit }) => read.channels(sort, limit),
  clear: () => repo.clear().then(() => null),
  dump: ({ store, after, limit }) => backup.dump(store, after, limit),
  restore: ({ store, rows }) => backup.restore(store, rows).then(() => null),
};

chrome.runtime.onMessage.addListener(
  (msg: Message, _sender, sendResponse: (r: Reply<unknown>) => void) => {
    const handler = handlers[msg.type] as ((req: unknown) => Promise<unknown>) | undefined;
    if (!handler) return false;
    handler(msg.req).then(
      (ok) => {
        if (MUTATING.has(msg.type)) touch(), bumpRev();
        sendResponse({ ok });
      },
      (e: unknown) => sendResponse({ error: String(e) }),
    );
    return true;
  },
);

chrome.action.onClicked.addListener(() => void chrome.runtime.openOptionsPage());
void repo.prune();
