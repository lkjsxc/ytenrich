// Separate stores keep identical video ids and artist/channel names independent in both apps.
import type { BaseStore, Origin, StoreName } from '../shared/types.ts';
export const BASES: readonly BaseStore[] = ['videos', 'days', 'channels', 'opens'];
export const storeOf = (name: BaseStore, origin: Origin = 'youtube'): StoreName =>
  origin === 'music' ? `music-${name}` : name;
export const STORES: readonly StoreName[] = [...BASES, ...BASES.map((s) => storeOf(s, 'music'))];
