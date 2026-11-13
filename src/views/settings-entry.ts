// One entry of the Settings list: "Group: Title", a description and a control. Built once, then synced in place,
// so typing in the search box or in a control is never interrupted by a repaint.
import { h } from '../shared/h.ts';
import {
  DEFAULT_SETTINGS,
  patchSettings,
  type SettingField,
  type Settings,
} from '../shared/settings.ts';

export type Entry = {
  readonly group: string;
  /** Lower-case text the search matches. */
  readonly text: string;
  readonly node: HTMLElement;
  /** Shows the stored value, leaving the focused control alone; returns whether it differs from the default. */
  sync(s: Settings, focused: Element | null): boolean;
};

type Control = { readonly input: HTMLElement; set(value: unknown): void };

function control(f: SettingField, save: (v: unknown) => void): Control {
  if (f.type === 'bool') {
    const input = h('input', { type: 'checkbox', onchange: () => save(input.checked) });
    return { input, set: (v) => void (input.checked = v === true) };
  }
  if (f.type === 'number') {
    const step = f.step ?? 1;
    const input = h('input', {
      type: 'number',
      min: f.min,
      max: f.max,
      step,
      onchange: () => {
        const n = Number((Math.round(Number(input.value) / step) * step).toFixed(4));
        if (n >= f.min && n <= f.max) save(n);
      },
    });
    return { input, set: (v) => void (input.value = f.step ? Number(v).toFixed(2) : String(v)) };
  }
  if (f.type === 'enum') {
    const input = h(
      'select',
      { onchange: () => save(input.value) },
      f.options.map((o) => h('option', { value: o }, o)),
    );
    return { input, set: (v) => void (input.value = String(v)) };
  }
  const input = h('input', {
    type: 'text',
    placeholder: f.placeholder,
    onchange: () => save(input.value),
  });
  return { input, set: (v) => void (input.value = String(v)) };
}

/** The shell every entry shares; `extra` sits at the right of the title line. */
export function frame(
  group: string,
  title: string,
  extra: HTMLElement | null,
  ...body: HTMLElement[]
): HTMLElement {
  return h(
    'div',
    { class: 'sitem' },
    h(
      'div',
      { class: 'stitle' },
      h('span', { class: 'muted' }, `${group}:`),
      h('b', null, title),
      extra,
    ),
    ...body,
  );
}

export const searchText = (...parts: string[]): string => parts.join(' ').toLowerCase();

export function fieldEntry(f: SettingField): Entry {
  const save = (v: unknown): void => void patchSettings({ [f.key]: v } as Partial<Settings>);
  const c = control(f, save);
  const reset = h(
    'button',
    {
      class: 'sreset',
      title: 'Back to the default',
      onclick: () => save(DEFAULT_SETTINGS[f.key]),
    },
    'Reset',
  );
  const node =
    f.type === 'bool'
      ? frame(
          f.group,
          f.title,
          reset,
          h('label', { class: 'scheck' }, c.input, h('span', null, f.desc)),
        )
      : frame(f.group, f.title, reset, h('div', { class: 'muted' }, f.desc), c.input);
  return {
    group: f.group,
    text: searchText(f.group, f.title, f.desc, f.key),
    node,
    sync(s, focused) {
      const changed = s[f.key] !== DEFAULT_SETTINGS[f.key];
      node.classList.toggle('changed', changed);
      reset.hidden = !changed;
      if (focused !== c.input) c.set(s[f.key]);
      return changed;
    },
  };
}
