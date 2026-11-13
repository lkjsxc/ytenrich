// Tiling WM on every page: a layout family per page kind, several workspaces per family (Alt+Shift+1…9, or the
// chips in the masthead). Alt+W toggles tiling. Unmounts during fullscreen.
import { spacesKey } from '../../shared/layout-store.ts';
import { patchSettings } from '../../shared/settings.ts';
import { createDisposables } from '../../shared/signal.ts';
import type { WmFamily } from '../../shared/types.ts';
import { createWmController, type Wm } from '../../wm/controller.ts';
import { DEFAULT_SPACES, familyOf } from '../../wm/presets.ts';
import * as S from '../../wm/spaces.ts';
import { createSpacesBar } from '../../wm/spaces-bar.ts';
import { placeInMasthead } from '../../youtube/masthead.ts';
import { isFullscreen } from '../../youtube/slots.ts';
import type { Feature } from '../features.ts';

const FAMILIES = Object.keys(DEFAULT_SPACES) as WmFamily[];

export const wm: Feature = {
  id: 'wm',
  start(rt) {
    const d = createDisposables();
    let ctl: Wm | undefined;
    let shown = 0; // the workspace `ctl` shows
    let spaces: Map<WmFamily, S.Spaces> | undefined; // one entry per family, once storage was read
    const of = (family: WmFamily): S.Spaces => spaces?.get(family) ?? S.parseSpaces(null, family);
    /** Shows `next` at once; the stored copy tells the other tabs and the next page. */
    const put = (family: WmFamily, next: S.Spaces, store = true): void => {
      spaces?.set(family, next);
      if (store) void S.saveSpaces(family, next);
      update();
    };
    const change = (op: typeof S.addSpace): void => {
      const family = ctl?.family;
      if (family) void op(family, of(family)).then((next) => put(family, next, false));
    };
    const pick = (n: number): void => {
      const family = ctl?.family;
      if (family && n <= of(family).count) put(family, { ...of(family), active: n });
    };
    const bar = createSpacesBar({ pick, add: () => change(S.addSpace) });

    function update(): void {
      if (!spaces) return;
      const on = rt.settings.get().wmEnabled && !isFullscreen();
      const family = on ? familyOf(rt.page.get().kind) : null;
      const s = family && of(family);
      document.documentElement.toggleAttribute('ytenrich-wm', family !== null);
      if (ctl && (ctl.family !== family || shown !== s?.active)) ctl.dispose(), (ctl = undefined);
      if (family && s && !ctl) {
        shown = s.active;
        const remove = { label: `Remove workspace ${shown}`, disabled: s.count < 2 };
        const menu = [{ ...remove, run: () => change(S.removeSpace) }];
        ctl = createWmController(rt, family, { index: shown, menu });
      } else ctl?.refresh();
      bar.show(s);
      placeInMasthead(bar.el);
    }
    const onKey = (e: KeyboardEvent): void => {
      if (!e.altKey || e.ctrlKey || e.metaKey) return;
      const digit = e.shiftKey ? /^Digit([1-9])$/.exec(e.code)?.[1] : undefined;
      if (!digit && e.code !== 'KeyW') return;
      e.preventDefault();
      if (digit) pick(Number(digit));
      else void patchSettings({ wmEnabled: !rt.settings.get().wmEnabled });
    };
    const onStorage = (c: Record<string, chrome.storage.StorageChange>, area: string): void => {
      for (const family of area === 'local' && spaces ? FAMILIES : []) {
        const change = c[spacesKey(family)];
        const next = change && S.mergeSpaces(of(family), S.parseSpaces(change.newValue, family));
        if (next && JSON.stringify(next) !== JSON.stringify(of(family))) put(family, next, false);
      }
    };
    void chrome.storage.local.get(FAMILIES.map(spacesKey)).then((stored) => {
      spaces = new Map(FAMILIES.map((f) => [f, S.parseSpaces(stored[spacesKey(f)], f)]));
      update();
    });
    chrome.storage.onChanged.addListener(onStorage);
    d.add(rt.settings.subscribe(update));
    d.add(rt.page.subscribe(update));
    d.add(rt.scanner.onTick(() => placeInMasthead(bar.el))); // the masthead renders after us
    document.addEventListener('fullscreenchange', update);
    window.addEventListener('keydown', onKey, true);
    d.add(() => {
      chrome.storage.onChanged.removeListener(onStorage);
      document.removeEventListener('fullscreenchange', update);
      window.removeEventListener('keydown', onKey, true);
      ctl?.dispose();
      bar.el.remove();
    });
    return d.dispose;
  },
};
