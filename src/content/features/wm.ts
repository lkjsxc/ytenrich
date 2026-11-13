// Tiling WM on every page: a layout family per page kind, nine workspaces per family (the chips in the masthead,
// or Alt+Shift+1…9). Alt+W toggles tiling. Unmounts during fullscreen.
import { spacesKey } from '../../shared/layout-store.ts';
import { patchSettings } from '../../shared/settings.ts';
import { createDisposables } from '../../shared/signal.ts';
import type { WmFamily } from '../../shared/types.ts';
import { createWmController, type Wm } from '../../wm/controller.ts';
import { familyOf } from '../../wm/presets.ts';
import { parseActive } from '../../wm/spaces.ts';
import { createSpacesBar } from '../../wm/spaces-bar.ts';
import { createWmStore } from '../../wm/store.ts';
import { placeInMasthead } from '../../youtube/masthead.ts';
import { isFullscreen } from '../../youtube/slots.ts';
import type { Feature } from '../features.ts';

export const wm: Feature = {
  id: 'wm',
  start(rt) {
    const d = createDisposables();
    const store = createWmStore();
    let ready = false; // nothing is drawn before the stored layouts are known, so no default flashes first
    let ctl: Wm | undefined;
    let shown = 0; // the workspace `ctl` shows
    const picked = new Map<WmFamily, number>(); // this tab's workspace per family, once it chose one
    const active = (family: WmFamily): number =>
      picked.get(family) ?? parseActive(store.get(spacesKey(family)));
    const pick = (n: number): void => {
      const family = ctl?.family;
      if (!family || n === active(family)) return;
      picked.set(family, n);
      store.save(spacesKey(family), { active: n });
      update();
    };
    const bar = createSpacesBar(pick);

    function update(): void {
      if (!ready) return;
      const on = rt.settings.get().wmEnabled && !isFullscreen();
      const family = on ? familyOf(rt.page.get().kind) : null;
      const n = family ? active(family) : 0;
      document.documentElement.toggleAttribute('ytenrich-wm', family !== null);
      if (ctl && (ctl.family !== family || shown !== n)) ctl.dispose(), (ctl = undefined);
      if (family && !ctl) ctl = createWmController(rt, family, store.space(family, (shown = n)));
      else ctl?.refresh();
      placeInMasthead(bar.el);
      bar.show(n);
    }
    const onKey = (e: KeyboardEvent): void => {
      if (!e.altKey || e.ctrlKey || e.metaKey) return;
      const digit = e.shiftKey ? /^Digit([1-9])$/.exec(e.code)?.[1] : undefined;
      if (!digit && e.code !== 'KeyW') return;
      e.preventDefault();
      if (digit) pick(Number(digit));
      else void patchSettings({ wmEnabled: !rt.settings.get().wmEnabled });
    };
    void store.ready.then(() => {
      ready = true;
      update();
    });
    d.add(rt.settings.subscribe(update));
    d.add(rt.page.subscribe(update));
    d.add(rt.scanner.onTick(() => placeInMasthead(bar.el))); // the masthead renders after us
    document.addEventListener('fullscreenchange', update);
    window.addEventListener('keydown', onKey, true);
    d.add(() => {
      document.removeEventListener('fullscreenchange', update);
      window.removeEventListener('keydown', onKey, true);
      ctl?.dispose();
      store.dispose();
      bar.el.remove();
    });
    return d.dispose;
  },
};
