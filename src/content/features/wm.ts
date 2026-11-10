// Tiling WM on every page but Shorts (layout family per page kind). Alt+W toggles. Unmounts during fullscreen.
import { patchSettings } from '../../shared/settings.ts';
import { createDisposables } from '../../shared/signal.ts';
import { createWmController, type Wm } from '../../wm/controller.ts';
import { familyOf } from '../../wm/presets.ts';
import { isFullscreen } from '../../youtube/slots.ts';
import type { Feature } from '../features.ts';

export const wm: Feature = {
  id: 'wm',
  start(rt) {
    const d = createDisposables();
    let ctl: Wm | undefined;
    const update = (): void => {
      const on = rt.settings.get().wmEnabled && !isFullscreen();
      const family = on ? familyOf(rt.page.get().kind) : null;
      document.documentElement.toggleAttribute('ytenrich-wm', family !== null);
      if (ctl && ctl.family !== family) ctl.dispose(), (ctl = undefined);
      if (family && !ctl) ctl = createWmController(rt, family);
      else ctl?.refresh();
    };
    const onKey = (e: KeyboardEvent): void => {
      if (e.altKey && !e.ctrlKey && !e.metaKey && e.code === 'KeyW') {
        e.preventDefault();
        void patchSettings({ wmEnabled: !rt.settings.get().wmEnabled });
      }
    };
    d.add(rt.settings.subscribe(update));
    d.add(rt.page.subscribe(update));
    document.addEventListener('fullscreenchange', update);
    window.addEventListener('keydown', onKey, true);
    d.add(() => {
      document.removeEventListener('fullscreenchange', update);
      window.removeEventListener('keydown', onKey, true);
      ctl?.dispose();
    });
    update();
    return d.dispose;
  },
};
