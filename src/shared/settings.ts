// Settings: flat, typed, schema-described so the Settings view renders itself.
export type HideMode = 'hide' | 'dim' | 'off';
/** What feeds the Recommended list: only what was on screen, everything on the page, or more loaded for it. */
export type Collect = 'more' | 'page' | 'shown';

export const DEFAULT_SETTINGS = {
  wmEnabled: true,
  hideMode: 'off' as HideMode,
  hideThreshold: 5,
  dismissEnabled: true,
  dismissLabel: '',
  statsEnabled: true, // explained on the welcome page, which also turns it off (views/consent.ts)
  thumbnailsEnabled: true, // Chromium only; the Firefox build has no image code
  collect: 'more' as Collect,
  tabWidth: 0, // px; 0 fits each tab to its title
  uiScale: 1, // 1.00 = normal size; ytenrich's own UI only
  tabScale: 1.2, // tab bars, on top of uiScale
  closeClicks: 3, // clicks on × that close a tab (1 = at once)
  recoMeta: false, // Recommended: how often and where each video appeared
  expandDetails: true, // watch pages open with the description expanded
  shortsAsVideos: true, // Shorts play in the watch player, tiled like any video
  introDone: false, // the welcome card above the Recommended lists was acknowledged (not in the schema)
};
export type Settings = typeof DEFAULT_SETTINGS;
export type SettingKey = keyof Settings;

type Kind =
  | { type: 'bool' }
  | { type: 'number'; min: number; max: number; step?: number }
  | { type: 'enum'; options: readonly string[] }
  | { type: 'text'; placeholder: string };
/** `group` and `title` read as "Group: Title" in the Settings view; all three texts are searched. */
export type SettingField = { key: SettingKey; group: string; title: string; desc: string } & Kind;

const field = (key: SettingKey, name: string, desc: string, kind: Kind): SettingField => {
  const [group = '', title = ''] = name.split(': ');
  return { key, group, title, desc, ...kind };
};
const BOOL: Kind = { type: 'bool' };
const num = (min: number, max: number, step?: number): Kind =>
  step ? { type: 'number', min, max, step } : { type: 'number', min, max };

const SCHEMA: readonly SettingField[] = [
  field('wmEnabled', 'Layout: Tiling', 'Tile every YouTube page into panes.', BOOL),
  field(
    'shortsAsVideos',
    'Layout: Shorts in the watch player',
    'Open Shorts in the regular watch page, tiled like every other video, instead of the Shorts player.',
    BOOL,
  ),
  field(
    'expandDetails',
    'Layout: Expand details',
    'Open every video with its description expanded.',
    BOOL,
  ),
  field(
    'tabWidth',
    'Layout: Tab width',
    'Width of a tab in px. 0 fits each tab to its title.',
    num(0, 400),
  ),
  field(
    'uiScale',
    'Layout: UI scale',
    'Size of ytenrich’s own UI. 1.00 is normal.',
    num(0.5, 2, 0.05),
  ),
  field(
    'tabScale',
    'Layout: Tab bar scale',
    'Size of the tab bars on top of the UI scale. 1.00 is the same as the rest.',
    num(0.8, 2, 0.05),
  ),
  field(
    'closeClicks',
    'Layout: Clicks to close a tab',
    'Clicks on × that close a tab. 1 closes at once.',
    num(1, 5),
  ),
  field(
    'statsEnabled',
    'Stats: Enable stats',
    'Count recommendations shown and videos opened, on this device only.',
    BOOL,
  ),
  field(
    'thumbnailsEnabled',
    'Stats: Images',
    'Show images in Stats, History and Recommended by requesting video IDs from YouTube’s image server.',
    BOOL,
  ),
  field(
    'collect',
    'Recommended: Collect',
    'What feeds the list. more: also load more of YouTube’s hidden lists. page: everything on the page. shown: only what was on screen.',
    { type: 'enum', options: ['more', 'page', 'shown'] },
  ),
  field(
    'recoMeta',
    'Recommended: Exposure line',
    'Show how often and where each video appeared.',
    BOOL,
  ),
  field(
    'hideMode',
    'Over-exposed videos: Mode',
    'What happens to videos recommended again and again over more than a day and never opened. Channels you open get more patience.',
    { type: 'enum', options: ['off', 'dim', 'hide'] },
  ),
  field(
    'hideThreshold',
    'Over-exposed videos: Impressions',
    'A video is over-exposed after this many impressions (three times as many for channels you open).',
    num(2, 100),
  ),
  field(
    'dismissEnabled',
    'Not interested: One-click button',
    'Put ⊘ next to every recommendation’s ⋮ menu.',
    BOOL,
  ),
  field(
    'dismissLabel',
    'Not interested: Extra menu label',
    'Another exact menu text to treat as “Not interested”, for a YouTube language ytenrich does not know.',
    { type: 'text', placeholder: 'exact menu text' },
  ),
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
