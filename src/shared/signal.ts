// Minimal observable value. Subscribers are owned by callers; each subscribe returns its disposer.
export type Signal<T> = {
  get(): T;
  set(value: T): void;
  update(fn: (value: T) => T): void;
  subscribe(fn: (value: T) => void): () => void;
};

export function createSignal<T>(initial: T): Signal<T> {
  let value = initial;
  const subs = new Set<(value: T) => void>(); // bound: one entry per live subscriber
  const set = (next: T): void => {
    if (Object.is(next, value)) return;
    value = next;
    for (const fn of [...subs]) fn(value);
  };
  return {
    get: () => value,
    set,
    update: (fn) => set(fn(value)),
    subscribe(fn) {
      subs.add(fn);
      return () => subs.delete(fn);
    },
  };
}

export type Disposer = () => void;

export function createDisposables(): { add(d: Disposer): void; dispose(): void } {
  let list: Disposer[] = [];
  return {
    add: (d) => void list.push(d),
    dispose() {
      const items = list;
      list = [];
      for (const d of items.reverse()) d();
    },
  };
}
