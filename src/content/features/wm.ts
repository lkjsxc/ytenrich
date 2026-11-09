// Tiling WM on watch pages. Alt+W toggles. Unmounts during fullscreen so YouTube owns the player.
import { patchSettings } from '../../shared/settings.ts';
import { createDisposables } from '../../shared/signal.ts';
import { createWmController, type Wm } from '../../wm/controller.ts';
import { isFullscreen } from '../../youtube/slots.ts';
import type { Feature } from '../features.ts';

export const wm: Feature = {
  id: 'wm',
  start(rt) {
    const d = createDisposables();
    let ctl: Wm | undefined;
    const update = (): void => {
      const want = rt.settings.get().wmEnabled && rt.page.get().kind === 'watch' && !isFullscreen();
      document.documentElement.toggleAttribute('ytenrich-wm', want);
      if (want && !ctl) ctl = createWmController(rt);
      else if (!want && ctl) ctl.dispose(), (ctl = undefined);
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
