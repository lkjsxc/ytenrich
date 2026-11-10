// Own-view tabs of one controller: lazily mounted per tab id, renamed by their view, dropped when closed.
import { dropViewState, loadViewState } from '../shared/view-state.ts';
import { freshTab, kindOf, type ViewEnv, viewOf } from '../views/registry.ts';
import { type Launcher, type LauncherApi, mountLauncher, NEW_TAB } from './launcher.ts';

type Mounted = { el: HTMLElement; dispose(): void; launcher?: Launcher };
export type OwnViews = {
  /** Element of an own tab (mounted on first use), or undefined for native tabs. */
  el(tab: string): HTMLElement | undefined;
  title(tab: string): string;
  /** A tab id for another instance of `kind`, with no state left over from a closed one. */
  fresh(kind: string, used: ReadonlySet<string>): string;
  /** After a render: unmounts closed tabs and refreshes New tab pages. */
  sync(open: ReadonlySet<string>): void;
  focus(tab: string): void;
  dispose(): void;
};

export function createOwnViews(
  env: Omit<ViewEnv, 'instance' | 'setTitle'>,
  family: string,
  launcher: (tab: string) => LauncherApi,
  onTitle: (tab: string, title: string) => void,
): OwnViews {
  const mounts = new Map<string, Mounted>(); // bound: one per open own tab
  const titles = new Map<string, string>(); // bound: one per open own tab
  const instance = (tab: string): string => `${family}:${tab}`;
  return {
    el(tab) {
      const def = viewOf(tab);
      const isNew = kindOf(tab) === NEW_TAB;
      if (!def?.mount && !isNew) return undefined;
      let m = mounts.get(tab);
      if (!m) {
        const el = document.createElement('div');
        el.className = 'view';
        if (isNew) {
          const l = mountLauncher(el, launcher(tab));
          m = { el, dispose: l.dispose, launcher: l };
        } else {
          const setTitle = (title: string): void => {
            titles.set(tab, title);
            onTitle(tab, title);
          };
          const dispose = def?.mount?.(el, { ...env, instance: instance(tab), setTitle });
          m = { el, dispose: dispose ?? (() => undefined) };
        }
        mounts.set(tab, m);
      }
      return m.el;
    },
    title(tab) {
      if (kindOf(tab) === NEW_TAB) return 'New tab';
      const def = viewOf(tab);
      if (def?.mount && !titles.has(tab)) {
        titles.set(tab, def.title); // a view's saved state may carry the title it last set
        void loadViewState<{ title: string }>(instance(tab)).then((s) => {
          if (typeof s.title !== 'string' || titles.get(tab) !== def.title) return;
          titles.set(tab, s.title);
          onTitle(tab, s.title);
        });
      }
      return titles.get(tab) ?? def?.title ?? tab;
    },
    fresh(kind, used) {
      const tab = freshTab(kind, used);
      if (tab !== kind) dropViewState(instance(tab));
      return tab;
    },
    sync(open) {
      for (const [tab, m] of mounts) {
        if (open.has(tab)) m.launcher?.update();
        else m.dispose(), mounts.delete(tab);
      }
      for (const tab of titles.keys()) if (!open.has(tab)) titles.delete(tab);
    },
    focus: (tab) => mounts.get(tab)?.launcher?.focus(),
    dispose() {
      for (const m of mounts.values()) m.dispose();
      mounts.clear();
    },
  };
}
