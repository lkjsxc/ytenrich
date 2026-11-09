// Tab click vs drag. Dropping on a pane edge splits it; on the body joins its tab stack; on a tab strip
// inserts at the pointer position (reorder), previewed as a caret between tabs.
import { h } from '../shared/h.ts';
import type { Zone } from './layout.ts';

const DRAG_PX = 6;
const STRIP_PX = 30;

export type DragOpts = {
  panes: ReadonlyMap<string, HTMLElement>;
  layer: HTMLElement;
  onClick(): void;
  onDrop(paneId: string, zone: Zone, index?: number): void;
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

/** Insertion index among tab rects (strip order) for pointer x, plus the caret x position. */
export function insertAt(tabs: readonly DOMRect[], x: number): [number, number] {
  const i = tabs.findIndex((r) => x < r.left + r.width / 2);
  const index = i < 0 ? tabs.length : i;
  const caret =
    index < tabs.length ? (tabs[index]?.left ?? 0) : (tabs[tabs.length - 1]?.right ?? 0);
  return [index, caret];
}

export function startTabDrag(e: PointerEvent, tab: HTMLElement, label: string, o: DragOpts): void {
  if (e.button !== 0) return;
  tab.setPointerCapture(e.pointerId);
  const sx = e.clientX;
  const sy = e.clientY;
  const origin = o.layer.getBoundingClientRect();
  const rects = [...o.panes].map(([id, el]) => [id, el.getBoundingClientRect()] as const);
  const tabRects = new Map(
    [...o.panes].map(([id, el]) => [
      id,
      [...el.querySelectorAll('.strip > .tab')].map((t) => t.getBoundingClientRect()),
    ]),
  );
  let dragging = false;
  let target: [string, Zone, number?] | undefined;
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
    preview.hidden = !hit;
    if (!hit) {
      target = undefined;
      return;
    }
    const [id, r] = hit;
    if (ev.clientY - r.top < STRIP_PX) {
      const [index, caret] = insertAt(tabRects.get(id) ?? [], ev.clientX);
      target = [id, 'center', index];
      preview.className = 'drop caret';
      preview.style.cssText = `left:${caret - origin.left - 1}px;top:${r.top - origin.top + 3}px;height:${STRIP_PX - 6}px`;
      return;
    }
    target = [id, zoneAt(r, ev.clientX, ev.clientY)];
    const [x, y, w, hh] = previewRect(r, target[1]);
    preview.className = 'drop';
    preview.style.cssText = `left:${x - origin.left}px;top:${y - origin.top}px;width:${w}px;height:${hh}px`;
  };
  const end = (): void => {
    tab.removeEventListener('pointermove', move);
    preview.remove();
    ghost.remove();
    if (!dragging) o.onClick();
    else if (target) o.onDrop(target[0], target[1], target[2]);
  };
  tab.addEventListener('pointermove', move);
  tab.addEventListener('lostpointercapture', end, { once: true });
}
