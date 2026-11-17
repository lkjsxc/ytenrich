// Open a video in the current tab. Inside YouTube, prefer clicking a native anchor (SPA navigation, no reload).
// Modified/middle clicks fall through to the browser so "open in new tab" gestures still work.
import type { VideoStat } from '../shared/types.ts';
import { navigateWatch } from '../youtube/open.ts';
import type { ViewEnv } from './registry.ts';

type Ref = Pick<VideoStat, 'id' | 'kind' | 'origin' | 'thumbnail'> & { readonly video?: string };

/** Shorts open in the watch player (they tile there, `content/features/shorts.ts`); a Mix starts its radio. */
export const videoUrl = (v: Ref): string =>
  v.kind === 'mix'
    ? `https://www.youtube.com/watch?v=${v.video}&list=${v.id}&start_radio=1`
    : `https://${v.origin === 'music' ? 'music' : 'www'}.youtube.com/watch?v=${v.id}`;

/** Thumbnail address; a Mix shows the video it opens with. */
export const thumbUrl = (v: Ref, size: 'default' | 'mqdefault'): string =>
  v.origin === 'music' &&
  /^https:\/\/(i\.ytimg\.com|lh3\.googleusercontent\.com)\//.test(v.thumbnail ?? '')
    ? v.thumbnail!
    : `https://i.ytimg.com/vi/${v.kind === 'mix' ? v.video || v.id : v.id}/${size}.jpg`;

export const kindBadge = (v: Ref): string =>
  v.kind === 'short' ? 'Short' : v.kind === 'mix' ? 'Mix' : '';

export function openVideo(e: MouseEvent, v: Ref, env: ViewEnv): void {
  if (e.button !== 0 || e.ctrlKey || e.metaKey || e.shiftKey || e.altKey) return;
  e.preventDefault();
  const native = env.scanner?.pageItems().get(v.id)?.anchor;
  // A Mix anchor starts the radio; for a plain video that would be the wrong thing.
  const list = Boolean(native?.search.includes('list='));
  if (native?.isConnected && list === (v.kind === 'mix')) native.click();
  else if (!navigateWatch(videoUrl(v))) location.assign(videoUrl(v));
}
