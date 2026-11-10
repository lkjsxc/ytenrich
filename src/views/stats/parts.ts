// Small building blocks shared by the Stats sections.
import { type Child, h } from '../../shared/h.ts';
import { num, pct } from './format.ts';
import { niceMax, ratio } from './period.ts';

export const card = (title: Child, ...children: Child[]): HTMLElement =>
  h('section', { class: 'card' }, h('h3', null, title), children);

/** One-of-many buttons. `kind` is the CSS class of the group (`seg-ctl` or `chips`). */
export function choice<T extends string | number>(
  kind: 'seg-ctl' | 'chips',
  options: readonly (readonly [T, string])[],
  current: T,
  pick: (value: T) => void,
): HTMLElement {
  return h(
    'div',
    { class: kind, role: 'group' },
    options.map(([value, label]) =>
      h(
        'button',
        {
          class: value === current ? 'chip on' : 'chip',
          'aria-pressed': String(value === current),
          onclick: () => pick(value),
        },
        label,
      ),
    ),
  );
}

export const legend = (items: readonly (readonly [cls: string, label: string])[]): HTMLElement =>
  h(
    'span',
    { class: 'legend' },
    items.map(([cls, label]) => h('span', null, h('i', { class: cls }), label)),
  );

/** Labelled horizontal bars (one measure, sorted by the caller) with value and share of the total. */
export function hbars(rows: readonly (readonly [label: string, value: number])[]): HTMLElement {
  const max = Math.max(1, ...rows.map(([, v]) => v));
  const total = rows.reduce((a, [, v]) => a + v, 0);
  return h(
    'div',
    { class: 'hbars' },
    rows.map(([label, v]) => [
      h('span', null, label),
      h('div', { class: 'track' }, h('div', { class: 'fill', style: `width:${(v / max) * 100}%` })),
      h('span', { class: 'v' }, `${num(v)} · ${pct(ratio(v, total))}`),
    ]),
  );
}

/** One column: stacked parts listed top first, and the text shown while it is hovered. */
export type Column = {
  readonly parts: readonly (readonly [cls: string, value: number])[];
  readonly tip: string;
};

/** Column chart on one shared axis. The readout line under it describes the hovered column. */
export function columns(
  cols: readonly Column[],
  xLabels: readonly string[],
  idle: string,
): HTMLElement {
  const sum = (c: Column): number => c.parts.reduce((a, [, v]) => a + v, 0);
  const max = niceMax(Math.max(1, ...cols.map(sum)));
  const readout = h('div', { class: 'readout' }, idle);
  const say = (text: string) => (): void => {
    readout.textContent = text;
  };
  const bars = cols.map((c) =>
    h(
      'div',
      { class: 'bcol', onpointerenter: say(c.tip) },
      c.parts
        .filter(([, v]) => v > 0)
        .map(([cls, v]) => h('div', { class: `seg ${cls}`, style: `height:${(v / max) * 100}%` })),
    ),
  );
  return h(
    'div',
    null,
    h(
      'div',
      { class: 'plot' },
      h(
        'div',
        { class: 'yaxis' },
        [max, max / 2, 0].map((v) => h('span', null, num(v))),
      ),
      h(
        'div',
        { class: cols.length > 40 ? 'cols dense' : 'cols', onpointerleave: say(idle) },
        bars,
      ),
    ),
    h(
      'div',
      { class: 'xaxis' },
      xLabels.map((l) => h('span', null, l)),
    ),
    readout,
  );
}
