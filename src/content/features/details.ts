// Watch pages open with the description expanded (setting `expandDetails`). Once per navigation: a later
// "Show less" stays.
import { expandDescription } from '../../youtube/details.ts';
import type { Feature } from '../features.ts';

const WINDOW_MS = 10_000; // after a navigation, the description may render this late

export const details: Feature = {
  id: 'details',
  start(rt) {
    let until = 0;
    const arm = (): void => {
      until =
        rt.page.get().kind === 'watch' && rt.settings.get().expandDetails
          ? Date.now() + WINDOW_MS
          : 0;
    };
    arm();
    const offPage = rt.page.subscribe(arm);
    // The box of the previous video can still read expanded right after a navigation, so the window stays open
    // until a click actually happened.
    const offTick = rt.scanner.onTick(() => {
      if (until && Date.now() < until && expandDescription()) until = 0;
    });
    return () => {
      offPage();
      offTick();
    };
  },
};
