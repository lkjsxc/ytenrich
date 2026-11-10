import { exportData, importData } from '../shared/backup.ts';
import { h } from '../shared/h.ts';
import { resetLayouts } from '../shared/layout-store.ts';
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

function actions(env: ViewEnv, status: HTMLElement): HTMLElement {
  const reset = (): void =>
    void resetLayouts().then(() => env.log.write('info', 'settings', 'layout reset to default'));
  const clear = (): void => {
    if (confirm('Delete all ytenrich statistics? This cannot be undone.'))
      void env.call('clear', null).then(() => env.log.write('info', 'settings', 'stats cleared'));
  };
  const say = (text: string, error = false): void => {
    status.textContent = text;
    status.className = error ? 'error' : 'muted';
    env.log.write(error ? 'warn' : 'info', 'settings', text);
  };
  const save = (): void => {
    say('Exporting…');
    exportData(env.call).then(
      (data) => {
        const url = URL.createObjectURL(
          new Blob([JSON.stringify(data)], { type: 'application/json' }),
        );
        h('a', { href: url, download: `ytenrich-${data.exportedAt.slice(0, 10)}.json` }).click();
        setTimeout(() => URL.revokeObjectURL(url), 60_000);
        const n = data.stats.videos.length;
        say(
          `Exported settings, layouts and ${n} videos of stats. The file contains your viewing record.`,
        );
      },
      (e: unknown) => say(String(e), true),
    );
  };
  const file = h('input', {
    type: 'file',
    accept: 'application/json,.json',
    hidden: true,
    onchange: () => {
      const picked = file.files?.[0];
      file.value = '';
      if (
        !picked ||
        !confirm(
          'Replace all ytenrich settings, layouts and statistics in this browser with this file?',
        )
      )
        return;
      say('Importing…');
      picked
        .text()
        .then((text) => importData(env.call, JSON.parse(text)))
        .then(
          (n) => say(`Imported ${n} rows of stats with settings and layouts.`),
          (e: unknown) => say(String(e), true),
        );
    },
  });
  return h(
    'div',
    { class: 'actions' },
    h(
      'button',
      { onclick: save, title: 'Saves settings, layouts and statistics as one JSON file' },
      'Export data',
    ),
    h(
      'button',
      { onclick: () => file.click(), title: 'Replaces everything with an exported file' },
      'Import data…',
    ),
    file,
    h(
      'button',
      { onclick: reset, title: 'Applies to every open YouTube tab' },
      'Reset tiling layout',
    ),
    h('button', { class: 'danger', onclick: clear }, 'Clear statistics…'),
  );
}

export function mountSettings(el: HTMLElement, env: ViewEnv): () => void {
  const status = h('p', { class: 'muted' });
  const render = (s: Settings): void => {
    const focused = (el.getRootNode() as Document | ShadowRoot).activeElement;
    if (focused && el.contains(focused)) return;
    el.replaceChildren(
      h('h2', null, 'Settings'),
      ...SETTINGS_SCHEMA.map((f) => field(f, s)),
      h('h2', { class: 'section' }, 'Layout & data'),
      actions(env, status),
      status,
    );
  };
  render(env.settings.get());
  return env.settings.subscribe(render);
}
