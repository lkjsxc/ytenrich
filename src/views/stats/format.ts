const plain = new Intl.NumberFormat('en');
const compact = new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 });

export const num = (n: number): string => (n < 10_000 ? plain.format(n) : compact.format(n));

export const pct = (r: number | null): string =>
  r === null ? '–' : `${r > 0 && r < 0.1 ? (r * 100).toFixed(1) : Math.round(r * 100)}%`;

export const ago = (t: number): string => {
  const m = Math.max(0, Math.round((Date.now() - t) / 60000));
  return m < 60 ? `${m}m` : m < 1440 ? `${Math.round(m / 60)}h` : `${Math.round(m / 1440)}d`;
};

const date = (key: string, opts: Intl.DateTimeFormatOptions): string =>
  new Date(`${key}T12:00`).toLocaleDateString('en', opts);
export const dayLong = (key: string): string =>
  date(key, { weekday: 'short', month: 'short', day: 'numeric' });
export const dayShort = (key: string): string => date(key, { month: 'short', day: 'numeric' });
/** A candidate's exposure: collected without ever being on screen reads as not shown yet. */
export const shownLine = (v: { seen: number; lastSeen: number; via: string }): string =>
  `${v.seen ? `shown ${v.seen}×` : 'not shown yet'}${v.via ? ` · from ${v.via}` : ''} · ${ago(v.lastSeen)} ago`;
