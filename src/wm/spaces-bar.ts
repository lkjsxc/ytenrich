// The workspace switcher: one numbered chip per workspace, placed in the masthead's free space by the WM feature.
import { h } from '../shared/h.ts';
import { SPACES } from './spaces.ts';

export type SpacesBar = {
  readonly el: HTMLElement;
  /** Marks the workspace showing; 0 (tiling off) hides the bar. */
  show(active: number): void;
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
  // Too narrow for all chips: they scroll sideways, by wheel as well.
  el.addEventListener('wheel', (e) => void (el.scrollLeft += e.deltaY || e.deltaX), {
    passive: true,
  });
  return {
    el,
    show(active) {
      el.hidden = !active;
      chips.forEach((chip, i) => chip.classList.toggle('on', i + 1 === active));
      const chip = chips[active - 1];
      if (chip && el.isConnected) chip.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    },
  };
}
