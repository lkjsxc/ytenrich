const plain = new Intl.NumberFormat('en');
const compact = new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 });

export const num = (n: number): string => (n < 10_000 ? plain.format(n) : compact.format(n));

export const pct = (r: number | null): string =>
  r === null ? '–' : `${r > 0 && r < 0.1 ? (r * 100).toFixed(1) : Math.round(r * 100)}%`;

export const ago = (t: number): string => {
  const m = Math.max(0, Math.round((Date.now() - t) / 60000));
  return m < 60 ? `${m}m` : m < 1440 ? `${Math.round(m / 60)}h` : `${Math.round(m / 1440)}d`;
};

/** Dates read yyyy/mm/dd everywhere. Day keys stay ISO (yyyy-mm-dd): they sort, and name backup files. */
export const dayText = (key: string): string => key.replaceAll('-', '/');
export const dayLong = (key: string): string =>
  `${dayText(key)} ${new Date(`${key}T12:00`).toLocaleDateString('en', { weekday: 'short' })}`;
/** A candidate's exposure: collected without ever being on screen reads as not shown yet. */
export const shownLine = (v: { seen: number; lastSeen: number; via: string }): string =>
  `${v.seen ? `shown ${v.seen}×` : 'not shown yet'}${v.via ? ` · from ${v.via}` : ''} · ${ago(v.lastSeen)} ago`;
/** Upload age in a few characters: "5h ago", "3d ago", "2w ago", "4mo ago", "2y ago". */
export function since(t: number): string {
  const d = Math.max(0, Date.now() - t) / 86_400_000;
  const text =
    d < 1
      ? `${Math.max(1, Math.round(d * 24))}h`
      : d < 14
        ? `${Math.round(d)}d`
        : d < 60
          ? `${Math.round(d / 7)}w`
          : d < 365
            ? `${Math.round(d / 30)}mo`
            : `${Math.floor(d / 365)}y`;
  return `${text} ago`;
}
