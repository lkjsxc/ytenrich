// Single dropdown menu in the overlay layer; closes on outside pointerdown, Escape, or selection.
import { h } from '../shared/h.ts';

export type MenuItem = {
  readonly label: string;
  readonly run: () => void;
  readonly disabled?: boolean;
};

export function openMenu(
  layer: HTMLElement,
  anchor: HTMLElement,
  items: readonly MenuItem[],
): void {
  const origin = layer.getBoundingClientRect();
  const a = anchor.getBoundingClientRect();
  const close = (): void => {
    menu.remove();
    window.removeEventListener('pointerdown', outside, true);
    window.removeEventListener('keydown', key, true);
  };
  const outside = (e: PointerEvent): void => {
    if (!e.composedPath().includes(menu)) close();
  };
  const key = (e: KeyboardEvent): void => {
    if (e.key === 'Escape') close();
  };
  const menu = h(
    'div',
    { class: 'menu', style: `left:${a.left - origin.left}px;top:${a.bottom - origin.top + 2}px` },
    items.length
      ? items.map((it) =>
          h(
            'button',
            { disabled: it.disabled === true, onclick: () => (close(), it.run()) },
            it.label,
          ),
        )
      : h('div', { class: 'empty' }, 'Nothing to add'),
  );
  layer.querySelector('.menu')?.remove();
  layer.append(menu);
  window.addEventListener('pointerdown', outside, true);
  window.addEventListener('keydown', key, true);
}
