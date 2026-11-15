import { readFileSync } from 'node:fs';
import { afterEach, expect, it } from 'vitest';
import { musicTrack } from '../src/youtube/music-record.ts';

afterEach(() => document.body.replaceChildren());
it('reads live player metadata independently of the browse URL, without shelf tiles', () => {
  document.body.innerHTML = readFileSync('tests/fixtures/music-player.html', 'utf8');
  const media = document.querySelector('video')!;
  Object.defineProperty(media, 'duration', { value: 180 });
  expect(musicTrack()).toEqual({
    id: '5qap5aO4i9A',
    title: 'lofi hip hop radio - beats to relax/study to',
    channel: 'Lofi Girl',
    thumbnail: 'https://i.ytimg.com/vi/5qap5aO4i9A/hqdefault.jpg',
    duration: 180,
  });
  const artist = document.querySelector('.byline')!;
  artist.textContent = 'Artist without a link • Album';
  expect(musicTrack()?.channel).toBe('Artist without a link');
  const ad = document.createElement('div');
  ad.className = 'ad-showing';
  document.querySelector('ytmusic-player')!.append(ad);
  expect(musicTrack()).toBeNull();
});
