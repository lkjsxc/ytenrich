import { expect, it } from 'vitest';
import { assertFullscreenAllocation } from '../scripts/smoke-session-fullscreen.ts';

it.each([
  { video: [0, 45, 1440, 810], player: [0, 0, 1440, 900] },
  { video: [0, 156, 1044, 587], player: [0, 0, 1044, 900] },
  { video: [467, 0, 506, 900], player: [0, 0, 1440, 900] },
])(
  'accepts native allocated fullscreen with normal letterboxing or chat: %j',
  ({ video, player }) => {
    expect(() => assertFullscreenAllocation(video, player, [1440, 900])).not.toThrow();
  },
);

it.each([
  { video: [0, 93, 947, 550], player: [0, 93, 947, 550] },
  { video: [0, 0, 400, 225], player: [0, 0, 1044, 900] },
  { video: [-10, 0, 1054, 900], player: [0, 0, 1044, 900] },
  { video: [0, 0, 1440, 900], player: [0, 0, 1440, 0] },
])(
  'rejects stale tiles, undersized or out-of-bounds video, and zero-area regions: %j',
  ({ video, player }) => {
    expect(() => assertFullscreenAllocation(video, player, [1440, 900])).toThrow();
  },
);
