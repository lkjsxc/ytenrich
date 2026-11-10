import { describe, expect, it } from 'vitest';
import { channelScore, rankByChannel, rankVideos } from '../src/shared/recommend.ts';
import { emptyStat } from '../src/shared/stats-rules.ts';
import type { ChannelStat, VideoStat } from '../src/shared/types.ts';

const NOW = 1_800_000_000_000;
const video = (id: string, channel: string, seen = 1, ageH = 0): VideoStat => ({
  ...emptyStat(id, NOW),
  channel,
  seen,
  lastSeen: NOW - ageH * 3600_000,
});
const chan = (name: string, seen: number, opened: number, dismissed = 0): ChannelStat => ({
  name,
  seen,
  opened,
  dismissed,
  videos: seen,
  lastSeen: NOW,
});
const channels = new Map(
  [chan('loved', 40, 12), chan('ignored', 200, 0), chan('disliked', 40, 12, 3)].map((c) => [
    c.name,
    c,
  ]),
);
const ids = (v: VideoStat[]): string => v.map((x) => x.id).join(' ');

describe('recommend', () => {
  it('prefers channels the user opens, fresh items, and items not shown over and over', () => {
    expect(channelScore(channels.get('loved'))).toBeGreaterThan(channelScore(undefined));
    expect(channelScore(undefined)).toBeGreaterThan(channelScore(channels.get('ignored')) - 0.2);
    expect(channelScore(channels.get('loved'))).toBeGreaterThan(
      channelScore(channels.get('disliked')),
    );
    const list = [
      video('old', 'new-ch', 1, 200),
      video('fresh', 'new-ch'),
      video('tired', 'new-ch', 9),
    ];
    expect(ids(rankVideos(list, channels, NOW))).toBe('fresh old tired');
    expect(ids(rankVideos([video('a', 'ignored'), video('b', 'loved')], channels, NOW))).toBe(
      'b a',
    );
  });
  it('a liked channel leads but tapers, so other channels get in before its last videos', () => {
    const list = ['l1', 'l2', 'l3', 'l4', 'l5'].map((id) => video(id, 'loved'));
    const order = ids(rankVideos([...list, video('n1', 'new-ch')], channels, NOW));
    expect(order).toBe('l1 l2 l3 l4 n1 l5');
  });
  it('groups by channel, most liked first, a few videos each, skipping unnamed channels', () => {
    const list = [
      video('x', ''),
      video('i1', 'ignored'),
      ...['l1', 'l2', 'l3', 'l4', 'l5'].map((id) => video(id, 'loved')),
    ];
    expect(ids(rankByChannel(list, channels, NOW))).toBe('l1 l2 l3 l4 i1');
  });
});
