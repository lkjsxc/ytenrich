// The Settings entries that act instead of holding a value: layout reset, and export, import and clearing of data.
import { exportData, importData } from '../shared/backup.ts';
import { h } from '../shared/h.ts';
import { resetLayouts } from '../shared/layout-store.ts';
import type { ViewEnv } from './registry.ts';
import { type Entry, frame, searchText } from './settings-entry.ts';

function action(group: string, title: string, desc: string, ...buttons: HTMLElement[]): Entry {
  return {
    group,
    text: searchText(group, title, desc),
    node: frame(
      group,
      title,
      null,
      h('div', { class: 'muted' }, desc),
      h('div', { class: 'actions' }, ...buttons),
    ),
    sync: () => false,
  };
}

/** `status` shows how the last action went. */
export function dataEntries(env: ViewEnv, status: HTMLElement): Entry[] {
  const say = (text: string, error = false): void => {
    status.textContent = text;
    status.className = error ? 'error' : 'muted';
    env.log.write(error ? 'warn' : 'info', 'settings', text);
  };
  const reset = (): void => void resetLayouts().then(() => say('Layout reset to the default.'));
  const clear = (): void => {
    if (confirm('Delete all ytenrich statistics? This cannot be undone.'))
      void env.call('clear', null).then(() => say('Statistics cleared.'));
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
        say(`Exported settings, layouts and ${data.stats.videos.length} videos of stats.`);
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
      const ask =
        'Replace all ytenrich settings, layouts and statistics in this browser with this file?';
      if (!picked || !confirm(ask)) return;
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
  return [
    action(
      'Layout',
      'Reset',
      'Put every tiling layout back to its default, on every open YouTube tab.',
      h('button', { onclick: reset }, 'Reset tiling layout'),
    ),
    action(
      'Data',
      'Export',
      'Save settings, layouts and statistics as one JSON file. The file contains your viewing record.',
      h('button', { onclick: save }, 'Export data'),
    ),
    action(
      'Data',
      'Import',
      'Replace everything in this browser with an exported file.',
      h('button', { onclick: () => file.click() }, 'Import data…'),
      file,
    ),
    action(
      'Data',
      'Clear statistics',
      'Delete all ytenrich statistics on this device. This cannot be undone.',
      h('button', { class: 'danger', onclick: clear }, 'Clear statistics…'),
    ),
  ];
}
