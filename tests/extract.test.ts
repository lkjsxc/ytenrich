// Fixtures are trimmed live YouTube DOM captured 2026-11 (refresh them when YouTube changes).
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  anchorsIn,
  extractItem,
  itemRootOf,
  menuHostOf,
  parseHref,
} from '../src/youtube/extract.ts';
import { pageKind, pageVideoId } from '../src/youtube/route.ts';
import { MENU_BUTTON } from '../src/youtube/selectors.ts';

const load = (name: string): HTMLElement => {
  const host = document.createElement('div');
  host.innerHTML = readFileSync(`tests/fixtures/${name}`, 'utf8');
  return host;
};
const items = (root: Element) => {
  const roots = new Set(
    [...anchorsIn(root)].map(itemRootOf).filter((r): r is Element => r !== null),
  );
  return [...roots].map((r) => ({
    tag: r.tagName.toLowerCase(),
    ...extractItem(r),
    anchor: undefined,
  }));
};

describe('youtube extract', () => {
  it('parses watch and shorts hrefs', () => {
    expect(parseHref('/watch?v=yPYZpwSpKmA&list=RD')).toEqual({ id: 'yPYZpwSpKmA', kind: 'video' });
    expect(parseHref('/watch?list=x&v=yPYZpwSpKmA')).toEqual({ id: 'yPYZpwSpKmA', kind: 'video' });
    expect(parseHref('/shorts/M93h41hyPsM')).toEqual({ id: 'M93h41hyPsM', kind: 'short' });
    expect(parseHref('/playlist?list=x')).toBeUndefined();
  });
  it('extracts related lockups', () => {
    const got = items(load('watch-related.html'));
    expect(got).toHaveLength(2);
    expect(got[0]).toMatchObject({
      tag: 'yt-lockup-view-model',
      id: 'yPYZpwSpKmA',
      kind: 'video',
      channel: 'Rick Astley',
    });
    expect(got[0]?.title).toContain('Together Forever');
  });
  it('takes the channel of a channel-tab tile from the page header, never from the counter row', () => {
    const got = items(load('channel-videos.html'));
    expect(got.map((g) => g.channel)).toEqual(['Rick Astley', 'Rick Astley', '']);
  });
  it('extracts shorts grid cells', () => {
    const got = items(load('search-shorts.html'));
    expect(got.length).toBeGreaterThan(1);
    expect(got[0]).toMatchObject({
      id: 'M93h41hyPsM',
      kind: 'short',
      title: 'Ranking Funny Cat Moment',
    });
  });
  it('extracts classic video renderers', () => {
    const got = items(load('search-video.html'));
    expect(got).toHaveLength(1);
    expect(got[0]?.tag).toBe('ytd-video-renderer');
    expect(got[0]?.title).not.toBe('');
  });
  it('classifies routes', () => {
    expect(pageKind(new URL('https://www.youtube.com/'))).toBe('home');
    expect(pageKind(new URL('https://www.youtube.com/@x/videos'))).toBe('channel');
    expect(pageVideoId(new URL('https://www.youtube.com/watch?v=abcdefghijk'))).toBe('abcdefghijk');
    expect(pageVideoId(new URL('https://www.youtube.com/shorts/abcdefghijk'))).toBe('abcdefghijk');
  });
  it('menu host holds our button but MENU_BUTTON still finds the native 3-dot', () => {
    for (const name of ['watch-related.html', 'search-shorts.html', 'search-video.html']) {
      const host = load(name);
      const roots = [...new Set([...anchorsIn(host)].map(itemRootOf))].filter(
        (r): r is Element => r !== null,
      );
      const root = roots.find((r) => menuHostOf(r));
      expect(root, name).toBeDefined();
      const ours = document.createElement('button');
      ours.setAttribute('ytenrich-dismiss', '');
      menuHostOf(root!)!.prepend(ours);
      const found = root!.querySelector(MENU_BUTTON);
      expect(found, name).not.toBeNull();
      expect(found, name).not.toBe(ours);
    }
  });
});
