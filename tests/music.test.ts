import { describe, expect, it } from 'vitest';
import { viewOf, viewsOf } from '../src/views/registry.ts';
import * as L from '../src/wm/layout.ts';
import { musicPreset, presetOf } from '../src/wm/presets.ts';
import { sideTabIndex } from '../src/youtube/music.ts';

const shape = (n: L.LayoutNode): unknown =>
  n.type === 'pane' ? n.tabs.join('|') : { [n.dir]: n.children.map(shape) };

describe('YouTube Music', () => {
  it('music presets: listening, reading along, the player large; no guide on a narrow window', () => {
    const side = { col: ['music-player', 'queue|lyrics|related'] };
    expect(shape(musicPreset(1440))).toEqual({ row: ['guide', 'page|settings|log', side] });
    expect((musicPreset(1440) as L.SplitNode).sizes[0]).toBeCloseTo(240 / 1440);
    expect(shape(musicPreset(1000))).toEqual({ row: ['page|settings|log', side] });
    expect(shape(presetOf('music', 2))).toEqual({
      row: [{ col: ['music-player', 'queue|related'] }, 'lyrics', 'page'],
    });
    expect(shape(presetOf('music', 3))).toEqual({
      row: ['music-player', 'queue|lyrics|related|page'],
    });
    const known = new Set(viewsOf('music').map((v) => v.id));
    for (const n of [1, 2, 3])
      expect(L.views(presetOf('music', n)).filter((v) => !known.has(v))).toEqual([]);
    // Lyrics and Related are two parts of one element, so they take turns; the queue is an element of its own.
    expect(['queue', 'lyrics', 'related'].map((v) => viewOf(v)?.slot)).toEqual([
      'queue',
      'side',
      'side',
    ]);
  });
  it('music side tabs: Lyrics is the second tab of the app, Related its last', () => {
    expect([4, 3, 2, 1].map((n) => sideTabIndex('lyrics', n))).toEqual([1, 1, 1, -1]);
    expect([4, 3, 2].map((n) => sideTabIndex('related', n))).toEqual([3, 2, -1]);
    expect(sideTabIndex('comments', 4)).toBe(-1);
  });
  it('a tab behind another one comes forward on a navigation', () => {
    const wide = presetOf('music', 3);
    expect(L.behind(wide, 'page')).toBe(true);
    expect(L.behind(L.activate(wide, 'page'), 'page')).toBe(false);
    expect(L.behind(wide, 'queue')).toBe(false);
    expect(L.behind(wide, 'guide')).toBe(false); // not in the layout: nothing to bring forward
  });
});
