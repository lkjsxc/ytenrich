// Settings: flat, typed, schema-described so the Settings view renders itself.
export type HideMode = 'hide' | 'dim' | 'off';
/** What feeds the Recommended list: only what was on screen, everything on the page, or more loaded for it.
 * `ask`: not chosen yet (acts as `shown`); enabling stats chooses `more`, older installs are asked in Recommended. */
export type Collect = 'ask' | 'more' | 'page' | 'shown';

export const DEFAULT_SETTINGS = {
  wmEnabled: true,
  hideMode: 'off' as HideMode,
  hideThreshold: 5,
  dismissEnabled: true,
  dismissLabel: '',
  statsEnabled: false, // on only after consent (views/consent.ts)
  thumbnailsEnabled: false,
  collect: 'ask' as Collect,
  tabWidth: 0, // px; 0 fits each tab to its title
  uiScale: 1, // 1.00 = normal size; ytenrich's own UI only
  tabScale: 1.2, // tab bars, on top of uiScale
  closeClicks: 3, // clicks on × that close a tab (1 = at once)
  recoMeta: false, // Recommended: how often and where each video appeared
};
export type Settings = typeof DEFAULT_SETTINGS;
export type SettingKey = keyof Settings;

export type SettingField =
  | { key: SettingKey; label: string; type: 'bool' }
  | { key: SettingKey; label: string; type: 'number'; min: number; max: number; step?: number }
  | { key: SettingKey; label: string; type: 'enum'; options: readonly string[] }
  | { key: SettingKey; label: string; type: 'text'; placeholder: string };

const SCHEMA: readonly SettingField[] = [
  { key: 'wmEnabled', label: 'Tiling layout (Alt+W)', type: 'bool' },
  {
    key: 'statsEnabled',
    label: 'Stats: count recommendations shown and videos opened, on this device only',
    type: 'bool',
  },
  {
    key: 'thumbnailsEnabled',
    label:
      'Show images in Stats, History and Recommended by requesting video IDs from YouTube’s image server',
    type: 'bool',
  },
  {
    key: 'collect',
    label:
      'Collect for Recommended: more = also load more of YouTube’s hidden lists, page = everything on the page, shown = only what was on screen, ask = not chosen yet',
    type: 'enum',
    options: ['ask', 'more', 'page', 'shown'],
  },
  {
    key: 'hideMode',
    label:
      'Over-exposed videos (recommended again and again over more than a day, never opened; channels you open get more patience)',
    type: 'enum',
    options: ['off', 'dim', 'hide'],
  },
  {
    key: 'hideThreshold',
    label: 'Over-exposed after N impressions (3 × N for channels you open)',
    type: 'number',
    min: 2,
    max: 100,
  },
  {
    key: 'tabWidth',
    label: 'Tab width in px (0 = fit the title)',
    type: 'number',
    min: 0,
    max: 400,
  },
  {
    key: 'uiScale',
    label: 'Scale of ytenrich’s own UI (1.00 = normal)',
    type: 'number',
    min: 0.5,
    max: 2,
    step: 0.05,
  },
  {
    key: 'tabScale',
    label: 'Scale of the tab bars (1.00 = same as the rest)',
    type: 'number',
    min: 0.8,
    max: 2,
    step: 0.05,
  },
  {
    key: 'closeClicks',
    label: 'Clicks on × needed to close a tab (1 = close at once)',
    type: 'number',
    min: 1,
    max: 5,
  },
  {
    key: 'recoMeta',
    label: 'Recommended: show how often and where each video appeared',
    type: 'bool',
  },
  { key: 'dismissEnabled', label: 'One-click "Not interested" button', type: 'bool' },
  {
    key: 'dismissLabel',
    label: 'Extra "Not interested" menu label',
    type: 'text',
    placeholder: 'exact menu text',
  },
];

/**
 * Remote thumbnails send video IDs to i.ytimg.com. The Firefox build declares no data transmission
 * (data_collection_permissions: none), so it neither offers nor loads them (views test `!__FIREFOX__`
 * inline so esbuild drops the image code from that build).
 */
export const SETTINGS_SCHEMA = SCHEMA.filter((f) => !__FIREFOX__ || f.key !== 'thumbnailsEnabled');

export const SETTINGS_KEY = 'settings';

export function parseSettings(value: unknown): Settings {
  const out: Settings = { ...DEFAULT_SETTINGS };
  if (typeof value !== 'object' || value === null) return out;
  const raw = value as Record<string, unknown>;
  for (const key of Object.keys(DEFAULT_SETTINGS) as SettingKey[]) {
    if (typeof raw[key] === typeof DEFAULT_SETTINGS[key])
      (out as Record<string, unknown>)[key] = raw[key];
  }
  return out;
}

export async function loadSettings(): Promise<Settings> {
  const stored = await chrome.storage.local.get(SETTINGS_KEY);
  return parseSettings(stored[SETTINGS_KEY]);
}

/** Stores only values that differ from the defaults, so changed defaults reach untouched settings. */
export async function patchSettings(patch: Partial<Settings>): Promise<void> {
  const next = { ...(await loadSettings()), ...patch };
  const diff = Object.entries(next).filter(([k, v]) => v !== DEFAULT_SETTINGS[k as SettingKey]);
  await chrome.storage.local.set({ [SETTINGS_KEY]: Object.fromEntries(diff) });
}

export function onSettings(fn: (s: Settings) => void): () => void {
  const listener = (changes: Record<string, chrome.storage.StorageChange>, area: string): void => {
    if (area === 'local' && changes[SETTINGS_KEY])
      fn(parseSettings(changes[SETTINGS_KEY].newValue));
  };
  chrome.storage.onChanged.addListener(listener);
  return () => chrome.storage.onChanged.removeListener(listener);
}
