import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  DESCRIPTION_MAX,
  listing,
  plainText,
  releaseNotes,
  SUMMARY_MAX,
  syncFirefoxListing,
} from '../scripts/store-listing.ts';

describe('store listing', () => {
  it('is complete, fits every store, and has notes for this version', () => {
    const l = listing();
    const { version } = JSON.parse(readFileSync('package.json', 'utf8')) as { version: string };
    expect(l.notes.version, 'write store/release-notes.md for this version').toBe(version);
    expect(l.notes.text).not.toBe('');
    expect(l.summary.length).toBeLessThanOrEqual(SUMMARY_MAX);
    expect(l.description.length).toBeLessThanOrEqual(DESCRIPTION_MAX);
    expect(l.reviewer).not.toBe('');
    expect(l.privacy).toMatch(/^ytenrich privacy policy\n/);
  });
  it('reads the newest notes and turns markdown into plain text', () => {
    expect(releaseNotes('<!-- x -->\n\n## 1.0.1\n- b\n\n## 1.0.0\n- a')).toEqual({
      version: '1.0.1',
      text: '- b',
    });
    expect(plainText('## A\n**b** `c` [d](https://e)\n- f')).toBe('A\nb c d (https://e)\n• f');
  });
  it('sends the listing to AMO in the add-on default locale', async () => {
    const calls: [string, RequestInit | undefined][] = [];
    const amo = async (url: string, init?: RequestInit) => {
      calls.push([url, init]);
      return new Response(JSON.stringify({ default_locale: 'en-US' }));
    };
    const { version } = listing().notes;
    await syncFirefoxListing(amo, 'A/', version);
    expect(calls.map(([url, init]) => `${init?.method ?? 'GET'} ${url}`)).toEqual([
      'GET A/',
      'PATCH A/',
      'PATCH A/eula_policy/',
      `PATCH A/versions/v${version}/`,
    ]);
    const body = (i: number) => JSON.parse(String(calls[i]?.[1]?.body));
    expect(body(1).description).toEqual({ 'en-US': listing().description });
    expect(body(2).privacy_policy['en-US']).toBe(listing().privacy);
    await expect(syncFirefoxListing(amo, 'A/', '9.9.9')).rejects.toThrow(/release-notes/);
  });
});
