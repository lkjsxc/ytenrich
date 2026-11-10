// Background: owns the stats DB and answers typed protocol messages.
import {
  type Api,
  type Message,
  type Method,
  type Reply,
  STATS_REV_KEY,
} from '../shared/protocol.ts';
import { DEFAULT_SETTINGS, loadSettings, onSettings } from '../shared/settings.ts';
import * as read from './stats-read.ts';
import * as repo from './stats-repo.ts';

// First install: the welcome page explains the extension and asks for recording consent.
chrome.runtime.onInstalled.addListener(({ reason }) => {
  if (reason === 'install')
    void chrome.tabs.create({ url: chrome.runtime.getURL('options.html#welcome') });
});

let threshold = DEFAULT_SETTINGS.hideThreshold;
void loadSettings().then((s) => (threshold = s.hideThreshold));
onSettings((s) => (threshold = s.hideThreshold));

const PRUNE_EVERY = 2000; // impressions between prune passes
let sincePrune = 0;

const REV_MS = 1500; // at most one stats-changed broadcast per window (trailing)
let revTimer: ReturnType<typeof setTimeout> | undefined;
const bumpRev = (): void => {
  if (revTimer) return;
  revTimer = setTimeout(() => {
    revTimer = undefined;
    void chrome.storage.local.set({ [STATS_REV_KEY]: Date.now() });
  }, REV_MS);
};
const MUTATING: ReadonlySet<Method> = new Set(['record', 'opened', 'dismissed', 'allow', 'clear']);

type Handlers = { [K in Method]: (req: Api[K]['req']) => Promise<Api[K]['res']> };
const handlers: Handlers = {
  async record({ items, hidden }) {
    sincePrune += items.length;
    if (sincePrune > PRUNE_EVERY) {
      sincePrune = 0;
      void repo.prune();
    }
    return { suppressed: await repo.record(items, hidden, threshold) };
  },
  opened: (req) => repo.opened(req).then(() => null),
  dismissed: ({ id }) => repo.dismissed(id).then(() => null),
  suppressed: async () => [...(await repo.suppressedIds(threshold))],
  query: (q) => read.query(q, threshold),
  overview: () => read.overview(threshold),
  channels: ({ sort, limit }) => read.channels(sort, limit),
  allow: ({ id, allowed }) => repo.allow(id, allowed).then(() => null),
  clear: () => repo.clear().then(() => null),
};

chrome.runtime.onMessage.addListener(
  (msg: Message, _sender, sendResponse: (r: Reply<unknown>) => void) => {
    const handler = handlers[msg.type] as ((req: unknown) => Promise<unknown>) | undefined;
    if (!handler) return false;
    handler(msg.req).then(
      (ok) => {
        if (MUTATING.has(msg.type)) bumpRev();
        sendResponse({ ok });
      },
      (e: unknown) => sendResponse({ error: String(e) }),
    );
    return true;
  },
);

chrome.action.onClicked.addListener(() => void chrome.runtime.openOptionsPage());
void repo.prune();
