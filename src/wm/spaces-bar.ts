// The workspace switcher: one numbered chip per workspace, placed in the masthead's free space by the WM feature.
// Chips keep one width. When the bar is narrower than all of them it scrolls sideways (by wheel too), and fades
// out toward a side that hides more, like a tab bar (youtube.css, classes set here).
import { h } from '../shared/h.ts';
import { SPACES } from './spaces.ts';

export type SpacesBar = {
  readonly el: HTMLElement;
  /** Marks the workspace showing; 0 (tiling off) hides the bar. */
  show(active: number): void;
  dispose(): void;
};

export function createSpacesBar(pick: (n: number) => void): SpacesBar {
  const el = document.createElement('ytenrich-spaces');
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
  const ro = new ResizeObserver(fade);
  ro.observe(el);
  return {
    el,
    show(active) {
      el.hidden = !active;
      chips.forEach((chip, i) => chip.classList.toggle('on', i + 1 === active));
      const chip = chips[active - 1];
      if (chip && el.isConnected) chip.scrollIntoView({ block: 'nearest', inline: 'nearest' });
      fade();
    },
    dispose() {
      ro.disconnect();
      el.remove();
    },
  };
}
