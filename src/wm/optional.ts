// Optional native views: their tab shows only while YouTube has the element (playlist, chapters), and a view
// that is new to the defaults is added once to layouts saved before it existed.
import type { ViewDef } from '../views/registry.ts';
import { onPlaylistToggle, resolveSlot } from '../youtube/slots.ts';
import * as L from './layout.ts';

const INTRODUCED_KEY = 'introduced';
/** Views added to the presets after layouts could already be saved: [view, the view whose pane it joins, behind
 * it (instead of in front of the pane's tabs)]. */
const LATE: readonly (readonly [string, string, boolean?])[] = [
  ['recommended', 'videos'],
  ['playlist', 'recommended'],
  ['chapters', 'details', true],
];

export type Optional = {
  /** The layout as it should be drawn now: without the optional tabs that have nothing to show. */
  visible(root: L.LayoutNode): L.LayoutNode;
  /** A saved layout plus the late views it has never been offered. */
  introduce(root: L.LayoutNode, introduced: unknown): L.LayoutNode;
  dispose(): void;
};

/** `ticks`: the scanner's DOM ticks, which see a chapter panel come and go (the playlist only flips `hidden`). */
export function createOptional(
  views: readonly ViewDef[],
  onChange: () => void,
  ticks: (fn: () => void) => () => void,
): Optional {
  const optional = views.filter((v) => v.optional && v.slot);
  let absent = '';
  const missing = (): string[] =>
    optional.filter((v) => v.slot && !resolveSlot(v.slot)).map((v) => v.id);
  const check = (): void => {
    if (missing().join() !== absent) onChange();
  };
  const offs = optional.length ? [onPlaylistToggle(check), ticks(check)] : [];
  return {
    visible(root) {
      const gone = missing();
      absent = gone.join();
      return L.retainViews(root, { has: (v) => !gone.includes(v) }) ?? root;
    },
    introduce(root, introduced) {
      const had = Array.isArray(introduced) ? (introduced as string[]) : [];
      const late = LATE.filter(([v]) => views.some((d) => d.id === v) && !had.includes(v));
      if (!late.length) return root;
      void chrome.storage.local.set({ [INTRODUCED_KEY]: [...had, ...late.map(([v]) => v)] });
      let next = root;
      for (const [view, beside, behind] of late) {
        const pane = L.paneOfView(next, beside);
        if (!pane || L.paneOfView(next, view)) continue;
        const at = behind ? pane.tabs.indexOf(beside) + 1 : 0;
        next = L.moveView(next, view, pane.id, 'center', at);
        if (behind) next = L.activate(next, pane.active);
      }
      return next;
    },
    dispose: () => offs.forEach((off) => off()),
  };
}
export { INTRODUCED_KEY };
