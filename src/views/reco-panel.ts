// The ▶ panel of a Recommended tab: everything the tab lists, set for this tab alone.
import { h } from '../shared/h.ts';
import { KINDS, ORDERS, type RecoSpec, SCOPES } from './reco-spec.ts';
import { choice } from './stats/parts.ts';

const row = (label: string, ...control: (HTMLElement | null)[]): HTMLElement =>
  h('div', { class: 'prow' }, label ? h('span', { class: 'muted' }, label) : null, ...control);

const check = (label: string, on: boolean, set: (on: boolean) => void): HTMLElement =>
  h(
    'label',
    { class: 'scheck' },
    h('input', {
      type: 'checkbox',
      checked: on,
      onchange: (e) => set((e.target as HTMLInputElement).checked),
    }),
    label,
  );

export function recoPanel(
  s: RecoSpec,
  initial: RecoSpec,
  change: (next: RecoSpec) => void,
): HTMLElement {
  const set = (patch: Partial<RecoSpec>): void => change({ ...s, ...patch });
  const same = JSON.stringify(s) === JSON.stringify(initial);
  return h(
    'div',
    { class: 'rpanel' },
    row(
      'Show',
      choice('seg-ctl', KINDS, s.kind, (kind) => set({ kind })),
    ),
    row(
      'From',
      choice('seg-ctl', SCOPES, s.scope, (scope) => set({ scope })),
    ),
    row(
      'Order',
      choice('seg-ctl', ORDERS, s.order, (order) => set({ order })),
    ),
    row(
      '',
      check('Group by channel', s.group, (group) => set({ group })),
      check('Include opened', s.opened, (opened) => set({ opened })),
    ),
    same
      ? null
      : row(
          '',
          h(
            'button',
            { class: 'sreset', onclick: () => change(initial) },
            'Back to this tab’s default',
          ),
        ),
  );
}
