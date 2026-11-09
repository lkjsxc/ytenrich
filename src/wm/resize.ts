// Pointer-driven split resize. Mutates flex-grow live; commits normalized sizes on release.
const MIN_PX = 120;

export function startResize(
  e: PointerEvent,
  dir: 'row' | 'col',
  index: number,
  cells: HTMLElement[],
  commit: (sizes: number[]) => void,
): void {
  const handle = e.currentTarget as HTMLElement;
  const a = cells[index];
  const b = cells[index + 1];
  if (!a || !b || e.button !== 0) return;
  e.preventDefault();
  handle.setPointerCapture(e.pointerId);
  handle.classList.add('active');
  const axis = (el: HTMLElement): number =>
    dir === 'row' ? el.getBoundingClientRect().width : el.getBoundingClientRect().height;
  const grow = (el: HTMLElement): number => Number.parseFloat(el.style.flexGrow) || 1;
  const startA = axis(a);
  const pairPx = startA + axis(b);
  const pairGrow = grow(a) + grow(b);
  const start = dir === 'row' ? e.clientX : e.clientY;
  const move = (ev: PointerEvent): void => {
    const px = Math.min(
      Math.max(startA + (dir === 'row' ? ev.clientX : ev.clientY) - start, MIN_PX),
      pairPx - MIN_PX,
    );
    a.style.flexGrow = String((pairGrow * px) / pairPx);
    b.style.flexGrow = String(pairGrow - (pairGrow * px) / pairPx);
  };
  const up = (): void => {
    handle.removeEventListener('pointermove', move);
    handle.classList.remove('active');
    commit(cells.map(grow));
  };
  handle.addEventListener('pointermove', move);
  handle.addEventListener('lostpointercapture', up, { once: true });
}
