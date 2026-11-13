// Shorts in the watch player (setting `shortsAsVideos`): a click on a Short, or any arrival on the Shorts player,
// goes to the regular watch page of that video instead, so it tiles like every other video.
import { shortsLinkOf } from '../../youtube/extract.ts';
import { watchUrl } from '../../youtube/route.ts';
import type { Feature } from '../features.ts';

const HINT = 'ytenrich-short'; // sessionStorage: the Short being moved, so the watch page records a Short

/** The id of a Short this tab was just moved from the Shorts player ('' if none). */
export function movedShort(): string {
  try {
    return sessionStorage.getItem(HINT) ?? '';
  } catch {
    return '';
  }
}
const go = (id: string, replace: boolean): void => {
  try {
    sessionStorage.setItem(HINT, id);
  } catch {}
  if (replace) location.replace(watchUrl(id));
  else location.assign(watchUrl(id));
};

export const shorts: Feature = {
  id: 'shorts',
  start(rt) {
    const on = (): boolean => rt.settings.get().shortsAsVideos;
    const onClick = (e: MouseEvent): void => {
      if (!on() || e.button !== 0 || e.ctrlKey || e.metaKey || e.shiftKey || e.altKey) return;
      const id = shortsLinkOf(e.target);
      if (!id) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      go(id, false);
    };
    const onPage = (): void => {
      const p = rt.page.get();
      if (on() && p.kind === 'shorts' && p.videoId) go(p.videoId, true);
    };
    window.addEventListener('click', onClick, true);
    onPage();
    const offPage = rt.page.subscribe(onPage);
    const offSettings = rt.settings.subscribe(onPage);
    return () => {
      window.removeEventListener('click', onClick, true);
      offPage();
      offSettings();
    };
  },
};
