import { createSignal, type Signal } from './signal.ts';

export type LogLevel = 'info' | 'warn' | 'error';
export type LogEntry = {
  readonly time: number;
  readonly level: LogLevel;
  readonly scope: string;
  readonly text: string;
};

const MAX_ENTRIES = 200; // ring buffer bound

export type Log = {
  readonly entries: Signal<readonly LogEntry[]>;
  write(level: LogLevel, scope: string, text: string): void;
};

export function createLog(): Log {
  const entries = createSignal<readonly LogEntry[]>([]);
  return {
    entries,
    write(level, scope, text) {
      const next = [...entries.get(), { time: Date.now(), level, scope, text }];
      entries.set(next.length > MAX_ENTRIES ? next.slice(-MAX_ENTRIES) : next);
      if (level !== 'info')
        console[level === 'warn' ? 'warn' : 'error'](`[ytenrich:${scope}] ${text}`);
    },
  };
}
