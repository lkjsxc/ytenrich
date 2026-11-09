import { h } from '../shared/h.ts';
import {
  patchSettings,
  SETTINGS_SCHEMA,
  type SettingField,
  type Settings,
} from '../shared/settings.ts';
import type { ViewEnv } from './registry.ts';

function field(f: SettingField, s: Settings): HTMLElement {
  const value = s[f.key];
  const save = (v: unknown): void => void patchSettings({ [f.key]: v } as Partial<Settings>);
  let input: HTMLElement;
  if (f.type === 'bool')
    input = h('input', {
      type: 'checkbox',
      checked: value === true,
      onchange: (e) => save((e.target as HTMLInputElement).checked),
    });
  else if (f.type === 'number')
    input = h('input', {
      type: 'number',
      min: f.min,
      max: f.max,
      value: String(value),
      onchange: (e) => {
        const n = Math.round(Number((e.target as HTMLInputElement).value));
        if (n >= f.min && n <= f.max) save(n);
      },
    });
  else if (f.type === 'enum')
    input = h(
      'select',
      { onchange: (e) => save((e.target as HTMLSelectElement).value) },
      f.options.map((o) => h('option', { value: o, selected: o === value }, o)),
    );
  else
    input = h('input', {
      type: 'text',
      placeholder: f.placeholder,
      value: String(value),
      onchange: (e) => save((e.target as HTMLInputElement).value),
    });
  return h('label', { class: 'field' }, h('span', null, f.label), input);
}

export function mountSettings(el: HTMLElement, env: ViewEnv): () => void {
  const render = (s: Settings): void => {
    const focused = (el.getRootNode() as Document | ShadowRoot).activeElement;
    if (focused && el.contains(focused)) return;
    el.replaceChildren(h('h2', null, 'Settings'), ...SETTINGS_SCHEMA.map((f) => field(f, s)));
  };
  render(env.settings.get());
  return env.settings.subscribe(render);
}
