// Tab click vs drag. Dropping on a pane edge splits it; on the center/strip joins its tab stack.
import { h } from '../shared/h.ts';
import type { Zone } from './layout.ts';

const DRAG_PX = 6;
const STRIP_PX = 30;

export type DragOpts = {
  panes: ReadonlyMap<string, HTMLElement>;
  layer: HTMLElement;
  onClick(): void;
  onDrop(paneId: string, zone: Zone): void;
};

export function zoneAt(r: DOMRect, x: number, y: number): Zone {
  if (y - r.top < STRIP_PX) return 'center';
  const fx = (x - r.left) / r.width;
  const fy = (y - r.top) / r.height;
  const edges: [Zone, number][] = [
    ['left', fx],
    ['right', 1 - fx],
    ['top', fy],
    ['bottom', 1 - fy],
  ];
  const [zone, dist] = edges.reduce((m, c) => (c[1] < m[1] ? c : m));
  return dist < 0.25 ? zone : 'center';
}

function previewRect(r: DOMRect, zone: Zone): [number, number, number, number] {
  const { left: x, top: y, width: w, height: hh } = r;
  if (zone === 'left') return [x, y, w / 2, hh];
  if (zone === 'right') return [x + w / 2, y, w / 2, hh];
  if (zone === 'top') return [x, y, w, hh / 2];
  if (zone === 'bottom') return [x, y + hh / 2, w, hh / 2];
  return [x, y, w, hh];
}

export function startTabDrag(e: PointerEvent, tab: HTMLElement, label: string, o: DragOpts): void {
  if (e.button !== 0) return;
  tab.setPointerCapture(e.pointerId);
  const sx = e.clientX;
  const sy = e.clientY;
  const origin = o.layer.getBoundingClientRect();
  const rects = [...o.panes].map(([id, el]) => [id, el.getBoundingClientRect()] as const);
  let dragging = false;
  let target: [string, Zone] | undefined;
  const preview = h('div', { class: 'drop' });
  const ghost = h('div', { class: 'ghost' }, label);
  const move = (ev: PointerEvent): void => {
    if (!dragging && Math.hypot(ev.clientX - sx, ev.clientY - sy) < DRAG_PX) return;
    if (!dragging) {
      dragging = true;
      o.layer.append(preview, ghost);
    }
    ghost.style.transform = `translate(${ev.clientX - origin.left + 12}px, ${ev.clientY - origin.top + 8}px)`;
    const hit = rects.find(
      ([, r]) =>
        ev.clientX >= r.left &&
        ev.clientX < r.right &&
        ev.clientY >= r.top &&
        ev.clientY < r.bottom,
    );
    target = hit && [hit[0], zoneAt(hit[1], ev.clientX, ev.clientY)];
    preview.hidden = !hit;
    if (!hit || !target) return;
    const [x, y, w, hh] = previewRect(hit[1], target[1]);
    preview.style.cssText = `left:${x - origin.left}px;top:${y - origin.top}px;width:${w}px;height:${hh}px`;
  };
  const end = (): void => {
    tab.removeEventListener('pointermove', move);
    preview.remove();
    ghost.remove();
    if (!dragging) o.onClick();
    else if (target) o.onDrop(target[0], target[1]);
  };
  tab.addEventListener('pointermove', move);
  tab.addEventListener('lostpointercapture', end, { once: true });
}
