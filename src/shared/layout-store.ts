// Persisted WM layouts: one chrome.storage.local key per page kind. Controllers follow changes live,
// so a reset (or an edit in another tab) applies everywhere.
export const LAYOUT_PREFIX = 'layout:';
export const layoutKey = (kind: string): string => `${LAYOUT_PREFIX}${kind}`;

export async function resetLayouts(): Promise<void> {
  const all = await chrome.storage.local.get(null);
  await chrome.storage.local.remove(Object.keys(all).filter((k) => k.startsWith(LAYOUT_PREFIX)));
}
