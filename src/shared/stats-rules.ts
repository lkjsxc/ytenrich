import { type DayStat, dayKey, type Impression, type VideoStat } from './types.ts';

export function isSuppressed(s: VideoStat, threshold: number): boolean {
  return !s.allowed && s.opened === 0 && s.dismissedAt === 0 && s.seen >= threshold;
}

export function emptyStat(id: string, now: number): VideoStat {
  return {
    id,
    kind: 'video',
    title: '',
    channel: '',
    firstSeen: now,
    lastSeen: now,
    seen: 0,
    opened: 0,
    dismissedAt: 0,
    allowed: false,
    surfaces: {},
  };
}

export function applyImpression(
  prev: VideoStat | undefined,
  item: Impression,
  now: number,
): VideoStat {
  const s = prev ?? emptyStat(item.id, now);
  return {
    ...s,
    kind: item.kind,
    title: item.title || s.title,
    channel: item.channel || s.channel,
    lastSeen: now,
    seen: s.seen + 1,
    surfaces: { ...s.surfaces, [item.surface]: (s.surfaces[item.surface] ?? 0) + 1 },
  };
}

export function bumpDay(
  prev: DayStat | undefined,
  now: number,
  field: 'seen' | 'opened' | 'dismissed',
  n = 1,
): DayStat {
  const d = prev ?? { day: dayKey(now), seen: 0, opened: 0, dismissed: 0 };
  return { ...d, [field]: d[field] + n };
}

export const PRUNE_AGE_MS = 90 * 24 * 3600 * 1000;
export const MAX_VIDEOS = 100_000;

export function isPrunable(s: VideoStat, now: number): boolean {
  return s.opened === 0 && !s.allowed && s.dismissedAt === 0 && now - s.lastSeen > PRUNE_AGE_MS;
}
