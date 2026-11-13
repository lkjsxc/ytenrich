import { describe, expect, it } from 'vitest';
import { EXPLORE_EVERY } from '../src/shared/diversify.ts';
import { channelScore, groupByChannel, rankVideos } from '../src/shared/recommend.ts';
import { emptyStat } from '../src/shared/stats-rules.ts';
import { affinity, learn, tokens } from '../src/shared/taste.ts';
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
  icon: '',
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
  it('a liked channel leads but tapers, so other channels get in early', () => {
    const list = ['l1', 'l2', 'l3', 'l4', 'l5'].map((id) => video(id, 'loved'));
    const order = ids(rankVideos([...list, video('n1', 'new-ch')], channels, NOW));
    expect(order).toBe('l1 l2 n1 l3 l4 l5');
  });
  it('a new user with one open gets no long run of one channel or topic', () => {
    // One opened video; YouTube then offers many look-alikes of it (same channel, same words) and some others.
    const fan = { ...chan('fan', 3, 1), videos: 3 };
    const known = new Map([['fan', fan]]);
    const taste = learn(['Minecraft speedrun world record'], [], []);
    const alike = Array.from({ length: 30 }, (_, i) => ({
      ...video(`a${i}`, i % 2 ? 'fan' : `copy${i}`),
      title: `Minecraft speedrun record ${i}`,
    }));
    const other = Array.from({ length: 30 }, (_, i) => ({
      ...video(`o${i}`, `ch${i}`, 1, 30),
      title: `${['Cooking', 'Jazz', 'Physics', 'Hiking', 'Chess'][i % 5]} topic number ${i}`,
    }));
    const order = rankVideos([...alike, ...other], known, NOW, taste).slice(0, 20);
    let run = 0;
    let longest = 0;
    for (const v of order)
      (run = v.id.startsWith('a') ? run + 1 : 0), (longest = Math.max(longest, run));
    expect(longest).toBeLessThanOrEqual(3);
    expect(order.filter((v) => v.channel === 'fan').length).toBeLessThanOrEqual(4);
    expect(order.some((v) => v.id.startsWith('a'))).toBe(true); // still favored, just not alone
  });
  it('every few slots trust YouTube alone, so a disliked-by-taste item can surface', () => {
    const taste = learn(
      Array.from({ length: 40 }, (_, i) => `Rust tutorial ${i}`),
      [],
      [],
    );
    const rust = Array.from({ length: 12 }, (_, i) => ({
      ...video(`r${i}`, `rc${i}`, 1, 20),
      title: `Rust part ${i}`,
    }));
    const pushed = { ...video('pushed', 'yt'), title: 'Gardening basics', offers: 5 };
    const order = ids(rankVideos([...rust, pushed], new Map(), NOW, taste)).split(' ');
    expect(order.indexOf('pushed')).toBeLessThan(EXPLORE_EVERY);
  });
  it('groups by channel, most liked first, a few videos each, skipping unnamed channels', () => {
    const list = [
      video('x', ''),
      video('i1', 'ignored'),
      ...['l1', 'l2', 'l3', 'l4', 'l5'].map((id) => video(id, 'loved')),
    ];
    expect(ids(groupByChannel(rankVideos(list, channels, NOW)))).toBe('l1 l2 l3 l4 i1');
  });
  it('learns title taste and lets it and repeated offers reorder equal candidates', () => {
    expect(tokens('Rust async 入門ガイド a')).toEqual([
      'rust',
      'async',
      '入門',
      '門ガ',
      'ガイ',
      'イド',
    ]);
    const taste = learn(
      ['Rust async basics', 'Rust lifetimes', 'Rust traits explained'],
      ['Celebrity gossip daily', 'Top gossip moments', 'Daily prank'],
      ['Prank gone wrong', 'Prank compilation'],
    );
    expect(affinity(taste, 'Advanced Rust')).toBeGreaterThan(1);
    expect(affinity(taste, 'Best prank ever')).toBeLessThan(affinity(taste, 'Gossip hour'));
    expect(affinity(taste, 'Gossip hour')).toBeLessThan(1);
    expect(affinity(taste, 'Cooking pasta')).toBe(1);
    const a = { ...video('a', 'new-ch'), title: 'Gossip hour' };
    const b = { ...video('b', 'new-ch'), title: 'Rust macros' };
    expect(ids(rankVideos([a, b], channels, NOW, taste))).toBe('b a');
    const often = { ...video('often', 'x'), offers: 4 };
    expect(ids(rankVideos([video('once', 'y'), often], channels, NOW))).toBe('often once');
  });
});
