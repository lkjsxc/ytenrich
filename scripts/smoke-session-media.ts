// Real media progress and native advertisement phase observation shared by the live session smokes.
import type { ElementHandle } from 'playwright';

/** Wait for observed media progress, including after an ad changes the media source. No timed seek or play call. */
export async function advance(media: ElementHandle<HTMLVideoElement>): Promise<void> {
  await media.evaluate(
    (video) =>
      new Promise<void>((resolve, reject) => {
        let start = video.currentTime;
        let source = video.currentSrc;
        const finish = (error?: Error): void => {
          clearTimeout(timer);
          video.removeEventListener('timeupdate', tick);
          error ? reject(error) : resolve();
        };
        const tick = (): void => {
          if (source !== video.currentSrc) {
            source = video.currentSrc;
            start = video.currentTime;
          }
          if (!video.paused && !video.seeking && video.currentTime > start + 0.2) finish();
        };
        const timer = setTimeout(
          () => finish(new Error('Video made no playback progress in 12 seconds')),
          12_000,
        );
        video.addEventListener('timeupdate', tick);
      }),
  );
}

/** Observe the one real player and replay old class values, preserving ad phases that begin and end
 * between snapshots. One observer, four media counters and one phase counter; no polling or source inference. */
export function observeMedia(video: HTMLVideoElement) {
  const player = video.closest('#movie_player');
  const counts = { pause: 0, emptied: 0, seeking: 0, ended: 0 };
  const events = ['pause', 'emptied', 'seeking', 'ended'] as const;
  let ad = Boolean(player?.classList.contains('ad-showing'));
  let adPhases = 0;
  let adChanges = 0;
  let title = ''; // bound: one ad-owned title, at most 300 characters; never emitted in smoke logs
  let pod: { index: number; total: number } | undefined;
  let disposed = false;
  const phase = (next: boolean): void => {
    if (next !== ad) {
      adPhases++;
      title = '';
      pod = undefined;
    }
    ad = next;
  };
  const flush = (records: readonly MutationRecord[]): void => {
    for (const record of records)
      phase((record.oldValue ?? '').split(/\s+/).includes('ad-showing'));
    phase(Boolean(player?.classList.contains('ad-showing')));
  };
  const creative = (): string | undefined => {
    if (!ad) return;
    const text = player?.querySelector('.ytp-ad-pod-index')?.textContent ?? '';
    const ordinal = /^\s*(\d{1,2})\s+of\s+(\d{1,2})\s*$/i.exec(text);
    const next = ordinal ? { index: Number(ordinal[1]), total: Number(ordinal[2]) } : undefined;
    const valid = next && next.index > 0 && next.index <= next.total ? next : undefined;
    const link = player?.querySelector<HTMLAnchorElement>('.ytp-title-link');
    const nextTitle =
      link && !link.getAttribute('href') ? (link.textContent ?? '').trim().slice(0, 300) : '';
    // An existing pod's ordinal is authoritative: delayed title rendering must not count its ad twice.
    const advanced = pod && valid && pod.total === valid.total && valid.index > pod.index;
    const changedTitle = !(pod && valid) && title && nextTitle && title !== nextTitle;
    if (advanced || changedTitle) adChanges++;
    if (nextTitle) title = nextTitle;
    pod = valid;
    return valid ? `${valid.index} of ${valid.total}` : undefined;
  };
  const observer = new MutationObserver(flush);
  if (player)
    observer.observe(player, {
      attributes: true,
      attributeFilter: ['class'],
      attributeOldValue: true,
    });
  const count = (event: Event): void => {
    counts[event.type as keyof typeof counts]++;
  };
  for (const event of events) video.addEventListener(event, count);
  return {
    video,
    snapshot() {
      if (!disposed) flush(observer.takeRecords());
      const adPod = disposed ? undefined : creative();
      return { counts: { ...counts }, ad, adPhases, adChanges, adPod };
    },
    dispose() {
      disposed = true;
      observer.disconnect();
      for (const event of events) video.removeEventListener(event, count);
    },
  };
}
