import { h } from '../shared/h.ts';
import type { LogEntry } from '../shared/log.ts';
import type { ViewEnv } from './registry.ts';

const row = (e: LogEntry): HTMLElement =>
  h(
    'div',
    { class: `log ${e.level}` },
    h('span', { class: 'muted' }, new Date(e.time).toLocaleTimeString()),
    ` ${e.level} ${e.scope}: ${e.text}`,
  );

export function mountLog(el: HTMLElement, env: ViewEnv): () => void {
  const render = (entries: readonly LogEntry[]): void =>
    el.replaceChildren(
      ...(entries.length
        ? [...entries].reverse().map(row)
        : [h('p', { class: 'muted' }, 'No events yet.')]),
    );
  render(env.log.entries.get());
  return env.log.entries.subscribe(render);
}
