// Small per-tab state of own views (e.g. which kind a Recommended tab lists), one storage key per instance.
const key = (instance: string): string => `view:${instance}`;

export async function loadViewState<T extends object>(instance: string): Promise<Partial<T>> {
  const value = (await chrome.storage.local.get(key(instance)))[key(instance)];
  return typeof value === 'object' && value !== null ? (value as Partial<T>) : {};
}

export const saveViewState = (instance: string, state: object): void =>
  void chrome.storage.local.set({ [key(instance)]: state });

export const dropViewState = (instance: string): void =>
  void chrome.storage.local.remove(key(instance));
