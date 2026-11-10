// Settings: flat, typed, schema-described so the Settings view renders itself.
export type HideMode = 'hide' | 'dim' | 'off';

export const DEFAULT_SETTINGS = {
  wmEnabled: true,
  hideMode: 'hide' as HideMode,
  hideThreshold: 5,
  dismissEnabled: true,
  dismissLabel: '',
  statsEnabled: true,
  thumbnailsEnabled: false,
};
export type Settings = typeof DEFAULT_SETTINGS;
export type SettingKey = keyof Settings;

export type SettingField =
  | { key: SettingKey; label: string; type: 'bool' }
  | { key: SettingKey; label: string; type: 'number'; min: number; max: number }
  | { key: SettingKey; label: string; type: 'enum'; options: readonly string[] }
  | { key: SettingKey; label: string; type: 'text'; placeholder: string };

const SCHEMA: readonly SettingField[] = [
  { key: 'wmEnabled', label: 'Tiling layout (Alt+W)', type: 'bool' },
  {
    key: 'statsEnabled',
    label: 'Record YouTube recommendations and opens on this device for stats and filtering',
    type: 'bool',
  },
  {
    key: 'thumbnailsEnabled',
    label: 'Show images in Stats and Shorts by requesting video IDs from YouTube’s image server',
    type: 'bool',
  },
  {
    key: 'hideMode',
    label: 'Over-exposed unopened videos',
    type: 'enum',
    options: ['hide', 'dim', 'off'],
  },
  {
    key: 'hideThreshold',
    label: 'Over-exposed after N impressions',
    type: 'number',
    min: 2,
    max: 100,
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
