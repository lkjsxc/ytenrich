/** Which app this content script runs in: youtube.com, or YouTube Music (music.youtube.com), a separate app with a
 * DOM of its own (`music.ts`, `music.css`). Everywhere else (options page, background, tests) it reads `youtube`. */
export type Site = 'youtube' | 'music';
export const SITE: Site =
  globalThis.location?.hostname === 'music.youtube.com' ? 'music' : 'youtube';
