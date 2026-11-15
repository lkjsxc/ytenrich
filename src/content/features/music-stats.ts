// Music records playback starts independently of page navigation and of the tiling feature.
import { createPlayRule } from '../../shared/music-play.ts';
import { MUSIC_MEDIA, musicTrack } from '../../youtube/music-record.ts';
import type { Feature } from '../features.ts';

const EVENTS = [
  'timeupdate',
  'playing',
  'pause',
  'seeking',
  'seeked',
  'ended',
  'loadedmetadata',
  'ratechange',
];
export const musicStats: Feature = {
  id: 'music-stats',
  start(rt) {
    let media: HTMLVideoElement | null = null;
    let rule = createPlayRule();
    const sample = (): void => {
      if (!media) return;
      if (!rt.settings.get().statsEnabled) {
        rule = createPlayRule();
        return;
      }
      const track = musicTrack();
      if (!track) return;
      const time = rule({
        id: track.id,
        position: media.currentTime,
        now: Date.now(),
        playing: !media.paused,
        seeking: media.seeking,
        ended: media.ended,
        rate: media.playbackRate,
      });
      if (time === null) return;
      void rt
        .call('played', { ...track, time })
        .catch((e: unknown) => rt.log.write('warn', 'music-stats', String(e)));
    };
    const detach = (): void => {
      for (const e of EVENTS) media?.removeEventListener(e, sample);
    };
    const attach = (): void => {
      const next = document.querySelector<HTMLVideoElement>(MUSIC_MEDIA);
      if (next === media) return;
      detach();
      media = next;
      for (const e of EVENTS) media?.addEventListener(e, sample);
      sample();
    };
    const off = rt.scanner.onTick(attach);
    let enabled = rt.settings.get().statsEnabled;
    const settings = rt.settings.subscribe((s) => {
      if (enabled === s.statsEnabled) return;
      enabled = s.statsEnabled;
      rule = createPlayRule();
      sample();
    });
    attach();
    return () => {
      off();
      settings();
      detach();
    };
  },
};
