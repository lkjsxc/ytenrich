import { describe, expect, it } from 'vitest';
import { parseSpec, recoSpec, specTitle, toQuery } from '../src/views/reco-spec.ts';

describe('reco spec', () => {
  it('names a tab after what it lists', () => {
    expect(specTitle(recoSpec())).toBe('Videos');
    expect(specTitle(recoSpec({ kinds: ['short', 'mix'] }))).toBe('Shorts + Mixes');
    expect(specTitle(recoSpec({ group: true }))).toBe('Channels');
    expect(specTitle(recoSpec({ scope: 'page' }))).toBe('This channel');
    expect(specTitle(recoSpec({ scope: 'named', channel: ' Lofi Girl ' }))).toBe('Lofi Girl');
  });
  it('resolves the channel, and has no query without one', () => {
    expect(toQuery(recoSpec({ scope: 'page' }), '')).toBeNull();
    expect(toQuery(recoSpec({ scope: 'page' }), 'A')?.channel).toBe('A');
    expect(toQuery(recoSpec({ scope: 'named', channel: '' }), 'A')).toBeNull();
    expect(toQuery(recoSpec({ channel: 'stale' }), 'A')?.channel).toBe('');
  });
  it('repairs stored specs from the tab default', () => {
    const or = recoSpec({ kinds: ['short'] });
    expect(parseSpec(null, or)).toBe(or);
    expect(parseSpec({ kinds: ['mix', 'bogus'], order: 'x', group: 1 }, or)).toEqual({
      ...or,
      kinds: ['mix'],
    });
    expect(parseSpec({ kinds: [] }, or).kinds).toEqual(['short']);
  });
});
