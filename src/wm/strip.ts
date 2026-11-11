// Tab bar behaviour: the guarded close button, sideways wheel scrolling and the "more tabs this way" fade.
import { h } from '../shared/h.ts';

const ARM_MS = 2500; // a started close is forgotten after this long without another click

/** × that closes on the n-th click; until then a ring fills around it (`--p` is the filled fraction). */
export function closeButton(need: () => number, run: () => void): HTMLElement {
  let count = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const show = (): void => {
    const left = need() - count;
    el.classList.toggle('arming', count > 0);
    el.style.setProperty('--p', String(count / need()));
    el.title = count ? `Click ${left} more time${left > 1 ? 's' : ''} to close` : 'Close tab';
  };
  const el: HTMLElement = h(
    'button',
    {
      class: 'x',
      title: 'Close tab',
      onpointerdown: (e) => e.stopPropagation(),
      onclick: () => {
        clearTimeout(timer);
        if (++count >= need()) return run();
        timer = setTimeout(() => ((count = 0), show()), ARM_MS);
        show();
      },
    },
    '×',
  );
  return el;
}

/** Marks which sides of a bar hide more tabs; ui.css fades the tabs out toward those sides. */
function fade(strip: HTMLElement): void {
  const max = strip.scrollWidth - strip.clientWidth;
  strip.classList.toggle('more-l', strip.scrollLeft > 1);
  strip.classList.toggle('more-r', strip.scrollLeft < max - 1);
}

// One observer for the bars of the current layout: a new render drops the old bars (bound: panes on screen).
const sizes = new ResizeObserver((entries) => {
  for (const e of entries) fade(e.target as HTMLElement);
});
export const forgetStrips = (): void => sizes.disconnect();

export function strip(children: (HTMLElement | HTMLElement[])[]): HTMLElement {
  const el = h('div', { class: 'strip' }, children);
  el.addEventListener('scroll', () => fade(el), { passive: true });
  // A vertical wheel scrolls the bar sideways when it holds more tabs than fit.
  el.addEventListener('wheel', (e) => {
    if (!e.deltaY || el.scrollWidth <= el.clientWidth) return;
    e.preventDefault();
    el.scrollLeft += e.deltaY;
  });
  sizes.observe(el);
  return el;
}
