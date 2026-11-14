import { describe, expect, it } from 'vitest';
import { parseSpec, recoSpec, specTitle, toQuery } from '../src/views/reco-spec.ts';

describe('reco spec', () => {
  it('names a tab after what it lists', () => {
    expect(specTitle(recoSpec())).toBe('Videos');
    expect(specTitle(recoSpec({ kind: 'mix' }))).toBe('Mix lists');
    expect(specTitle(recoSpec({ group: true }))).toBe('Channels');
    expect(specTitle(recoSpec({ scope: 'page' }))).toBe('This channel');
    expect(specTitle(recoSpec({ scope: 'page', kind: 'short' }))).toBe('This channel · Shorts');
  });
  it('resolves the channel and the search, and has no query without a page channel', () => {
    expect(toQuery(recoSpec({ scope: 'page' }), '')).toBeNull();
    expect(toQuery(recoSpec({ scope: 'page' }), 'A')?.channel).toBe('A');
    expect(toQuery(recoSpec(), 'A')).toMatchObject({ channel: '', kinds: ['video'], text: '' });
    expect(toQuery(recoSpec({ kind: 'short' }), '', '  lo fi ')?.text).toBe('lo fi');
  });
  it('repairs stored specs from the tab default', () => {
    const or = recoSpec({ kind: 'short' });
    expect(parseSpec(null, or)).toBe(or);
    expect(parseSpec({ kind: 'mix', scope: 'named', order: 'x', group: 1 }, or)).toEqual({
      ...or,
      kind: 'mix',
    });
    expect(parseSpec({ kinds: ['video'] }, or).kind).toBe('short');
  });
});
