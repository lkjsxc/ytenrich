// Workspaces: every layout family holds SPACES layouts and shows one, like virtual desktops. Which one shows is
// this tab's own choice; it is stored only as the start for the next page.
export const SPACES = 9;

/** What a controller needs of its workspace (`wm/store.ts` provides it). */
export type Space = {
  readonly index: number;
  /** The saved layout as stored (`undefined`: none yet). */
  readonly stored: unknown;
  save(layout: unknown): void;
  /** Calls back when the saved layout changes from elsewhere (a reset, another tab). */
  watch(fn: (stored: unknown) => void): () => void;
};

/** The workspace a stored `{ active }` names (1 when nothing usable is stored). */
export function parseActive(value: unknown): number {
  const n = (value as { active?: unknown } | null)?.active;
  return typeof n === 'number' && Number.isInteger(n) && n >= 1 && n <= SPACES ? n : 1;
}
