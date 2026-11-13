// The ⚙ panel of a Recommended tab: everything the tab lists, set for this tab alone.
import { h } from '../shared/h.ts';
import type { Kind } from '../shared/types.ts';
import { KINDS, ORDERS, type RecoSpec, SCOPES } from './reco-spec.ts';
import type { ViewEnv } from './registry.ts';
import { choice } from './stats/parts.ts';

const CHANNEL_NAMES = 300; // channels offered as completions, most opened first

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
  env: ViewEnv,
  change: (next: RecoSpec) => void,
): HTMLElement {
  const set = (patch: Partial<RecoSpec>): void => change({ ...s, ...patch });
  // Several kinds at once; the last one cannot be switched off.
  const kinds = h(
    'div',
    { class: 'chips', role: 'group' },
    KINDS.map(([k, label]) => {
      const on = s.kinds.includes(k);
      const toggle = (): void => {
        const next: Kind[] = on ? s.kinds.filter((x) => x !== k) : [...s.kinds, k];
        if (next.length) set({ kinds: KINDS.map(([x]) => x).filter((x) => next.includes(x)) });
      };
      return h('button', { class: on ? 'chip on' : 'chip', onclick: toggle }, label);
    }),
  );
  const list = h('datalist', { id: `names-${env.instance}` });
  let name: HTMLInputElement | null = null;
  if (s.scope === 'named') {
    name = h('input', {
      type: 'text',
      value: s.channel,
      placeholder: 'Exact channel name',
      list: list.id,
      onchange: (e) => set({ channel: (e.target as HTMLInputElement).value }),
    });
    void env.call('channels', { sort: 'opened', limit: CHANNEL_NAMES }).then(
      (rows) => list.replaceChildren(...rows.map((c) => h('option', { value: c.name }))),
      () => undefined,
    );
  }
  const same = JSON.stringify(s) === JSON.stringify(initial);
  return h(
    'div',
    { class: 'rpanel' },
    row('Show', kinds),
    row(
      'From',
      choice('seg-ctl', SCOPES, s.scope, (scope) => set({ scope })),
      name,
      list,
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
