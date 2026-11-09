// Native projection: YouTube elements stay in place but are fixed-positioned over WM pane bodies.
import type { Log } from '../shared/log.ts';
import { wakeGuide } from '../youtube/guide.ts';
import type { WatchSlot } from '../youtube/selectors.ts';
import { resolveWatchSlot } from '../youtube/slots.ts';

export type ProjEntry = {
  readonly view: string;
  readonly slot: WatchSlot;
  readonly body: HTMLElement | null;
};
export type Projector = {
  sync(entries: readonly ProjEntry[]): void;
  refresh(): void;
  dispose(): void;
};

const SLOT = 'ytenrich-slot';
const INACTIVE = 'ytenrich-slot-inactive';
const PROPS = ['left', 'top', 'width', 'height'] as const;
const REQUIRED: readonly WatchSlot[] = ['player', 'videos'];
const RETRY_MS = 250;
const RETRIES = 40;

function release(el: HTMLElement): void {
  el.removeAttribute(SLOT);
  el.removeAttribute(INACTIVE);
  for (const p of PROPS) el.style.removeProperty(p);
}

export function createProjector(log: Log): Projector {
  let entries: readonly ProjEntry[] = [];
  const tagged = new Map<WatchSlot, { el: HTMLElement; rect: string }>(); // bound: one per slot kind
  let frame = 0;
  let retryTimer: ReturnType<typeof setTimeout> | undefined;
  let retries = 0;
  let resizeTimer: ReturnType<typeof setTimeout> | undefined;
  const ro = new ResizeObserver(() => schedule());

  const apply = (): void => {
    frame = 0;
    let missing: WatchSlot[] = [];
    const live = new Set<WatchSlot>();
    for (const { view, slot, body } of entries) {
      const el = resolveWatchSlot(slot);
      const prev = tagged.get(slot);
      if (prev && prev.el !== el) release(prev.el), tagged.delete(slot);
      if (!el) {
        if (body) missing.push(slot);
        continue;
      }
      live.add(slot);
      const t = tagged.get(slot) ?? { el, rect: '' };
      tagged.set(slot, t);
      if (el.getAttribute(SLOT) !== view) el.setAttribute(SLOT, view);
      el.toggleAttribute(INACTIVE, !body);
      if (!body) continue;
      const r = body.getBoundingClientRect();
      const rect = `${r.left},${r.top},${r.width},${r.height}`;
      if (rect === t.rect) continue;
      t.rect = rect;
      const values = [r.left, r.top, r.width, r.height];
      PROPS.forEach((p, i) => el.style.setProperty(p, `${values[i]}px`, 'important'));
      if (slot === 'player') {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(() => window.dispatchEvent(new Event('resize')), 120);
      }
    }
    for (const [slot, t] of tagged) if (!live.has(slot)) release(t.el), tagged.delete(slot);
    if (missing.includes('guide')) void wakeGuide().then((ok) => ok && invalidate());
    missing = missing.filter((s) => REQUIRED.includes(s));
    if (missing.length && retries > 0) {
      retries--;
      clearTimeout(retryTimer);
      retryTimer = setTimeout(schedule, RETRY_MS);
    } else if (missing.length && retries === 0) {
      retries = -1;
      log.write(
        'warn',
        'wm',
        `native slots not found: ${missing.join(', ')} (YouTube DOM changed?)`,
      );
    }
  };
  const schedule = (): void => {
    frame ||= requestAnimationFrame(apply);
  };
  /** Re-applies every rect (and refits the player): YouTube may have measured mid-drawer-toggle. */
  const invalidate = (): void => {
    for (const t of tagged.values()) t.rect = '';
    schedule();
  };
  const onResize = (e: Event): void => {
    if (e.isTrusted) schedule();
  };
  window.addEventListener('resize', onResize);

  return {
    sync(next) {
      ro.disconnect();
      entries = next;
      for (const e of entries) if (e.body) ro.observe(e.body);
      invalidate();
    },
    refresh() {
      retries = RETRIES;
      invalidate();
    },
    dispose() {
      ro.disconnect();
      cancelAnimationFrame(frame);
      clearTimeout(retryTimer);
      clearTimeout(resizeTimer);
      window.removeEventListener('resize', onResize);
      for (const t of tagged.values()) release(t.el);
      tagged.clear();
      window.dispatchEvent(new Event('resize'));
    },
  };
}
