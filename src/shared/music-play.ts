// One bounded state per kept player. Media progress qualifies a start; seeking and paused time do not.
export type PlaySample = {
  id: string;
  position: number;
  now: number;
  playing: boolean;
  seeking: boolean;
  ended: boolean;
  rate: number;
};
export function createPlayRule() {
  let id = '';
  let position = 0;
  let at = 0;
  let played = 0;
  let sent = false;
  let ended = false;
  let advancing = false;
  let start: number | null = null;
  return (s: PlaySample): number | null => {
    if (!s.id) return null;
    const fresh = s.id !== id || (ended && s.position <= 1 && !s.ended);
    if (fresh) {
      id = s.id;
      played = 0;
      sent = false;
      ended = false;
      advancing = false;
      start = null;
    }
    if (s.playing && !s.ended) start ??= s.now;
    if (!fresh && advancing && !s.seeking) {
      const delta = s.position - position;
      // A seek cannot manufacture listening time. Media events can be delayed by background throttling.
      const elapsed = Math.max(0, (s.now - at) / 1000) * s.rate;
      if (delta > 0 && delta <= elapsed + 0.5) played += Math.min(delta, elapsed);
    }
    ended ||= s.ended;
    position = s.position;
    at = s.now;
    advancing = s.playing && !s.seeking && !s.ended;
    if (played < 10 || sent) return null;
    sent = true;
    return start;
  };
}
