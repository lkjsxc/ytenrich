// Open a video in the current tab. Inside YouTube, prefer clicking a native anchor (SPA navigation, no reload).
// Modified/middle clicks fall through to the browser so "open in new tab" gestures still work.
import type { Kind } from '../shared/types.ts';
import type { ViewEnv } from './registry.ts';

export const videoUrl = (id: string, kind: Kind): string =>
  kind === 'short'
    ? `https://www.youtube.com/shorts/${id}`
    : `https://www.youtube.com/watch?v=${id}`;

export function openVideo(e: MouseEvent, id: string, kind: Kind, env: ViewEnv): void {
  if (e.button !== 0 || e.ctrlKey || e.metaKey || e.shiftKey || e.altKey) return;
  e.preventDefault();
  const native = env.scanner?.pageItems().get(id)?.anchor;
  // Mix/playlist anchors would start a radio instead of the plain video.
  if (native?.isConnected && !native.search.includes('list=')) native.click();
  else location.assign(videoUrl(id, kind));
}
