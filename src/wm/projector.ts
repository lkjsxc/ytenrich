// Native projection: YouTube elements stay in place but are fixed-positioned over WM pane bodies.
import type { Log } from '../shared/log.ts';
import { wakeGuide } from '../youtube/guide.ts';
import type { NativeSlot } from '../youtube/selectors.ts';
import { resolveSlot } from '../youtube/slots.ts';

export type ProjEntry = {
  readonly slot: NativeSlot;
  /** Views that share a slot differ by part; the first one with a body gets the element. */
  readonly part?: string;
  readonly body: HTMLElement | null;
};
export type Projector = {
  sync(entries: readonly ProjEntry[]): void;
  refresh(): void;
  /** Gives every element back to YouTube at once (tiling off, fullscreen). */
  release(): void;
  dispose(): void;
};

const SLOT = 'ytenrich-slot';
const PART = 'ytenrich-part';
const INACTIVE = 'ytenrich-slot-inactive';
const PROPS = ['left', 'top', 'width', 'height'] as const;
const REQUIRED: readonly NativeSlot[] = ['player', 'videos', 'page', 'guide']; // retried ~10s (guide: re-woken)
const REFIT: readonly NativeSlot[] = ['player', 'page']; // YouTube re-measures these on window resize
const RETRY_MS = 250;
const RETRIES = 40;

function release(el: HTMLElement): void {
  el.removeAttribute(SLOT);
  el.removeAttribute(PART);
  el.removeAttribute(INACTIVE);
  for (const p of PROPS) el.style.removeProperty(p);
}

export function createProjector(log: Log): Projector {
  let entries: readonly ProjEntry[] = [];
  const tagged = new Map<NativeSlot, { el: HTMLElement; rect: string }>(); // bound: one per slot kind
  let frame = 0;
  let retryTimer: ReturnType<typeof setTimeout> | undefined;
  let retries = 0;
  let resizeTimer: ReturnType<typeof setTimeout> | undefined;
  const ro = new ResizeObserver(() => schedule());

  const apply = (): void => {
    frame = 0;
    let missing: NativeSlot[] = [];
    const live = new Set<NativeSlot>();
    const shown = new Map<NativeSlot, ProjEntry>(); // bound: one per slot kind
    for (const e of entries) if (!shown.get(e.slot)?.body) shown.set(e.slot, e);
    for (const e of entries) if (shown.get(e.slot) !== e) e.body?.classList.add('empty');
    for (const { slot, part, body } of shown.values()) {
      const el = resolveSlot(slot);
      const prev = tagged.get(slot);
      if (prev && prev.el !== el) release(prev.el), tagged.delete(slot);
      body?.classList.toggle('empty', !el);
      if (!el) {
        if (body) missing.push(slot);
        continue;
      }
      live.add(slot);
      const t = tagged.get(slot) ?? { el, rect: '' };
      tagged.set(slot, t);
      if (el.getAttribute(SLOT) !== slot) el.setAttribute(SLOT, slot);
      if ((el.getAttribute(PART) ?? undefined) !== part) {
        if (part) el.setAttribute(PART, part);
        else el.removeAttribute(PART);
        el.scrollTo(0, 0);
      }
      el.toggleAttribute(INACTIVE, !body);
      if (!body) continue;
      const r = body.getBoundingClientRect();
      const rect = `${r.left},${r.top},${r.width},${r.height}`;
      if (rect === t.rect) continue;
      t.rect = rect;
      const values = [r.left, r.top, r.width, r.height];
      PROPS.forEach((p, i) => el.style.setProperty(p, `${values[i]}px`, 'important'));
      if (REFIT.includes(slot)) {
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
  function releaseAll(): void {
    ro.disconnect();
    entries = [];
    cancelAnimationFrame(frame);
    frame = 0;
    clearTimeout(retryTimer);
    clearTimeout(resizeTimer);
    if (!tagged.size) return;
    for (const t of tagged.values()) release(t.el);
    tagged.clear();
    window.dispatchEvent(new Event('resize'));
  }

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
    release: releaseAll,
    dispose() {
      releaseAll();
      window.removeEventListener('resize', onResize);
    },
  };
}
