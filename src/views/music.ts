// YouTube Music's native views: parts of the app's player page, shown while something is loaded in the player.
// The queue is an element of its own; Lyrics and Related are two lists the app draws in one panel, so they are
// parts of one slot and take turns (`youtube/music-live.ts` selects the app's tab for the one on show).
import type { WmFamily } from '../shared/types.ts';
import type { ViewDef } from './registry.ts';

const M: readonly WmFamily[] = ['music'];

export const MUSIC_VIEWS: readonly ViewDef[] = [
  {
    id: 'music-player',
    title: 'Player',
    hint: 'YouTube Music: the video or cover of what is playing (shown while something is loaded)',
    slot: 'player',
    optional: true,
    families: M,
  },
  {
    id: 'queue',
    title: 'Up next',
    hint: 'YouTube Music: the queue being played (shown while something is loaded)',
    slot: 'queue',
    optional: true,
    families: M,
  },
  {
    id: 'lyrics',
    title: 'Lyrics',
    hint: 'YouTube Music: lyrics of the song being played, following it from track to track',
    slot: 'side',
    part: 'lyrics',
    optional: true,
    families: M,
  },
  {
    id: 'related',
    title: 'Related',
    hint: 'YouTube Music: more like what is playing (takes turns with Lyrics)',
    slot: 'side',
    part: 'related',
    optional: true,
    families: M,
  },
];
