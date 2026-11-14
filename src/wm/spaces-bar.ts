// The workspace switcher: one numbered chip per workspace, placed in the masthead's free space by the WM feature.
// Chips keep one width. When the bar is narrower than all of them it scrolls sideways (by wheel too), and fades
// out toward a side that hides more, like a tab bar (youtube.css, classes set here). The search box has the room
// first: a bar too narrow for a few chips hides (`tiny`), and Alt+Shift+1–9 still switch.
import { h } from '../shared/h.ts';
import { SPACES } from './spaces.ts';

export type SpacesBar = {
  readonly el: HTMLElement;
  /** Marks the workspace showing; 0 (tiling off) hides the bar. */
  show(active: number): void;
  dispose(): void;
};

const TINY_PX = 72; // narrower than about two chips: hidden
const EDGE_PX = 24; // the fade at a clipped side; the active chip is kept clear of it

export function createSpacesBar(pick: (n: number) => void): SpacesBar {
  const el = document.createElement('ytenrich-spaces');
  let active = 0;
  const chips = Array.from({ length: SPACES }, (_, i) =>
    h(
      'button',
      { title: `Workspace ${i + 1} (Alt+Shift+${i + 1})`, onclick: () => pick(i + 1) },
      String(i + 1),
    ),
  );
  el.append(...chips);
  const fade = (): void => {
    const max = el.scrollWidth - el.clientWidth;
    el.classList.toggle('more-l', el.scrollLeft > 1);
    el.classList.toggle('more-r', el.scrollLeft < max - 1);
  };
  el.addEventListener('scroll', fade, { passive: true });
  el.addEventListener('wheel', (e) => void (el.scrollLeft += e.deltaY || e.deltaX), {
    passive: true,
  });
  // Scrolls only the bar (scrollIntoView would also scroll the page) so the active chip shows clear of the fades.
  const reveal = (): void => {
    const chip = chips[active - 1];
    if (!chip || !el.isConnected) return;
    const c = chip.getBoundingClientRect();
    const b = el.getBoundingClientRect();
    if (c.left < b.left + EDGE_PX) el.scrollLeft -= b.left + EDGE_PX - c.left;
    else if (c.right > b.right - EDGE_PX) el.scrollLeft += c.right - b.right + EDGE_PX;
  };
  const fit = (): void => {
    el.classList.toggle('tiny', el.clientWidth < TINY_PX);
    reveal();
    fade();
  };
  const ro = new ResizeObserver(fit);
  ro.observe(el);
  return {
    el,
    show(n) {
      active = n;
      el.hidden = !n;
      chips.forEach((chip, i) => chip.classList.toggle('on', i + 1 === n));
      fit();
    },
    dispose() {
      ro.disconnect();
      el.remove();
    },
  };
}
