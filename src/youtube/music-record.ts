// Read the kept player's DOM, never the browse URL: queue advance need not navigate the page.
import type { MusicPlay } from '../shared/types.ts';
import { PLAYER, QUEUE_PLAYING } from './music.ts';
export const MUSIC_MEDIA = `${PLAYER} video`;
export function musicTrack(): Omit<MusicPlay, 'time'> | null {
  const player = document.querySelector(PLAYER);
  if (!player || player.querySelector('.ad-showing')) return null;
  const link = player.querySelector<HTMLAnchorElement>('.ytp-title-link');
  const id = link ? new URL(link.href, location.href).searchParams.get('v') : null;
  if (!id) return null;
  const bar = document.querySelector('ytmusic-player-bar');
  const queue = document.querySelector(QUEUE_PLAYING);
  const text = (el: Element | null | undefined): string =>
    el?.textContent?.trim().slice(0, 200) ?? '';
  const image = player.querySelector<HTMLImageElement>('#song-image img');
  const thumb = image?.src.startsWith('https:')
    ? image.src
    : (queue?.querySelector<HTMLImageElement>('img')?.src ?? '');
  const media = player.querySelector('video');
  return {
    id,
    title: text(bar?.querySelector('.title')) || text(link),
    channel:
      text(bar?.querySelector('.byline a')) ||
      text(bar?.querySelector('.byline')).split('•')[0]?.trim() ||
      text(queue?.querySelector('.byline')).split('•')[0]?.trim() ||
      '',
    thumbnail: thumb,
    duration: Number.isFinite(media?.duration) ? (media?.duration ?? 0) : 0,
  };
}
