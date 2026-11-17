// A native miniplayer may load a selected/next video without navigating. Return that loaded video to watch,
// so its companions and the existing History/Stats open follow it; never issue a second playback request.
// During ads the title link has no content URL, so MAIN reads only the native content-video ID.
type Player = HTMLElement & { getVideoData?: () => { video_id?: string } };
let frame = 0; // bound: one media-triggered frame, coalescing metadata and playing events
const restore = (): void => {
  frame = 0;
  if (
    !document.documentElement.matches('[ytenrich-wm][ytenrich-session]') ||
    document.fullscreenElement
  )
    return;
  const player = document.querySelector<Player>('ytd-miniplayer #movie_player');
  let id: string | undefined;
  try {
    id = player?.getVideoData?.().video_id;
  } catch {
    return;
  }
  if (
    !id ||
    !/^[\w-]{6,64}$/.test(id) ||
    id === document.querySelector('ytd-watch-flexy')?.getAttribute('video-id')
  )
    return;
  player?.querySelector<HTMLElement>('.ytp-miniplayer-expand-watch-page-button')?.click();
};
const changed = (event: Event): void => {
  if (
    event.target instanceof HTMLVideoElement &&
    event.target.closest('ytd-miniplayer #movie_player') &&
    document.documentElement.matches('[ytenrich-wm][ytenrich-session]')
  )
    frame ||= requestAnimationFrame(restore);
};
for (const event of ['loadedmetadata', 'playing']) document.addEventListener(event, changed, true);
document.addEventListener('yt-navigate-finish', () => {
  cancelAnimationFrame(frame);
  frame = 0;
});

export {};
