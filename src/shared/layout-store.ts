// Persisted WM layouts: one chrome.storage.local key per layout family and workspace, plus one per family for
// its workspaces (`wm/spaces.ts`). Controllers follow changes live, so a reset (or an edit in another tab)
// applies everywhere.
export const LAYOUT_PREFIX = 'layout:';
/** Workspace 1 keeps the plain family key. */
export const layoutKey = (kind: string, space = 1): string =>
  `${LAYOUT_PREFIX}${kind}${space > 1 ? `:${space}` : ''}`;
export const spacesKey = (kind: string): string => `${LAYOUT_PREFIX}${kind}:spaces`;

export async function resetLayouts(): Promise<void> {
  const all = await chrome.storage.local.get(null);
  await chrome.storage.local.remove(Object.keys(all).filter((k) => k.startsWith(LAYOUT_PREFIX)));
}
