// The workspace switcher: numbered chips and `+`, placed in the masthead's free space by the WM feature.
import { h } from '../shared/h.ts';
import { MAX_SPACES, type Spaces } from './spaces.ts';

export type SpacesBar = {
  readonly el: HTMLElement;
  /** Draws the chips; `null` (tiling off) hides the bar. */
  show(s: Spaces | null): void;
};

export function createSpacesBar(on: { pick(n: number): void; add(): void }): SpacesBar {
  const el = document.createElement('ytenrich-spaces');
  return {
    el,
    show(s) {
      el.hidden = !s;
      if (!s) return;
      const chips = Array.from({ length: s.count }, (_, i) =>
        h(
          'button',
          {
            class: i + 1 === s.active ? 'on' : '',
            title: `Workspace ${i + 1} (Alt+Shift+${i + 1})`,
            onclick: () => on.pick(i + 1),
          },
          String(i + 1),
        ),
      );
      const add = h(
        'button',
        { title: 'New workspace, a copy of this one. A pane’s menu removes it.', onclick: on.add },
        '+',
      );
      el.replaceChildren(...chips, s.count < MAX_SPACES ? add : '');
    },
  };
}
