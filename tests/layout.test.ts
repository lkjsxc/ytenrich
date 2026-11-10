import { describe, expect, it } from 'vitest';
import { freshTab, kindOf, viewOf, viewsOf } from '../src/views/registry.ts';
import * as L from '../src/wm/layout.ts';
import { addEdge } from '../src/wm/layout-edge.ts';
import { parseLayout } from '../src/wm/layout-parse.ts';
import {
  browsePreset,
  familyOf,
  homePreset,
  shortsPreset,
  watchPreset,
} from '../src/wm/presets.ts';
import { insertAt, zoneAt } from '../src/wm/tab-drag.ts';

const shape = (n: L.LayoutNode): unknown =>
  n.type === 'pane' ? n.tabs.join('|') : { [n.dir]: n.children.map(shape) };

/** The watch preset as these tests were written: no Playlist tab, Videos for Recommended, History beside it. */
const watch = (): L.LayoutNode => {
  const base = L.removeView(watchPreset(), 'playlist') as L.LayoutNode;
  const old = L.replaceView(base, 'recommended', 'videos');
  return L.moveView(old, 'history', L.paneOfView(old, 'videos')?.id ?? '', 'center', 2);
};

describe('layout', () => {
  it('preset has player over details | comments, and recommendations', () => {
    expect(shape(watch())).toEqual({
      row: [
        { col: ['player', { row: ['details', 'comments|chat'] }] },
        'videos|stats|history|settings|log',
      ],
    });
  });
  it('browse preset: guide beside the page; every preset view exists in its family', () => {
    const b = browsePreset(1600) as L.SplitNode;
    expect(shape(b)).toEqual({ row: ['guide', 'page|stats|history|settings|log'] });
    expect(b.sizes[0]).toBeCloseTo(0.15);
    for (const [family, preset] of [
      ['browse', b],
      ['shorts', shortsPreset()],
      ['home', homePreset(1600)],
      ['watch', watch()],
    ] as const) {
      const known = new Set(viewsOf(family).map((v) => v.id));
      expect(L.views(preset).filter((v) => !known.has(v))).toEqual([]);
    }
    expect(viewsOf('browse').some((v) => v.id === 'player')).toBe(false);
    expect(shape(homePreset(1600))).toEqual({
      row: ['guide', 'home-videos|home-shorts|stats|history|settings|log'],
    });
  });
  it('page kinds map to layout families (Shorts tiles as a page)', () => {
    expect(
      ['watch', 'home', 'search', 'channel', 'subs', 'other', 'shorts'].map((k) =>
        familyOf(k as never),
      ),
    ).toEqual(['watch', 'home', 'browse', 'browse', 'browse', 'browse', 'shorts']);
  });
  it('moves a tab to a pane edge, splitting it, and flattens same-direction splits', () => {
    const root = watch();
    const right = L.paneOfView(root, 'videos')!;
    const next = L.moveView(root, 'stats', right.id, 'right');
    expect(shape(next)).toEqual({
      row: [
        { col: ['player', { row: ['details', 'comments|chat'] }] },
        'videos|history|settings|log',
        'stats',
      ],
    });
    const s = next as L.SplitNode;
    expect(s.sizes.reduce((a, b) => a + b, 0)).toBeCloseTo(1);
    expect(s.sizes[0]).toBeCloseTo(0.44);
  });
  it('moving the only tab of a pane to its own edge is a no-op', () => {
    const root = watch();
    const p = L.paneOfView(root, 'player')!;
    expect(shape(L.moveView(root, 'player', p.id, 'left'))).toEqual(shape(root));
  });
  it('removing the last tab removes the pane and collapses the split', () => {
    const root = L.removeView(watch(), 'player')!;
    expect(shape(root)).toEqual({
      row: ['details', 'comments|chat', 'videos|stats|history|settings|log'],
    });
  });
  it('center drop joins and activates', () => {
    const root = watch();
    const p = L.paneOfView(root, 'player')!;
    const next = L.moveView(root, 'comments', p.id, 'center');
    expect(L.paneOfView(next, 'comments')).toMatchObject({
      tabs: ['player', 'comments'],
      active: 'comments',
    });
  });
  it('reorders tabs within a strip and inserts at an index across panes', () => {
    const root = L.removeView(watch(), 'history') as L.LayoutNode;
    const right = L.paneOfView(root, 'videos')!;
    const r1 = L.moveView(root, 'log', right.id, 'center', 0);
    expect(L.paneOfView(r1, 'log')?.tabs).toEqual(['log', 'videos', 'stats', 'settings']);
    const r2 = L.moveView(root, 'videos', right.id, 'center', 3);
    expect(L.paneOfView(r2, 'videos')?.tabs).toEqual(['stats', 'settings', 'videos', 'log']);
    const r3 = L.moveView(root, 'stats', right.id, 'center', 2);
    expect(shape(r3)).toEqual(shape(root));
    const det = L.paneOfView(root, 'details')!;
    const r4 = L.moveView(root, 'stats', det.id, 'center', 1);
    expect(L.paneOfView(r4, 'stats')).toMatchObject({
      tabs: ['details', 'stats'],
      active: 'stats',
    });
  });
  it('addEdge wraps the layout with a sized edge pane and moves an existing view there', () => {
    const next = addEdge(watch(), 'guide', 'left', 0.15) as L.SplitNode;
    expect(shape(next)).toEqual({
      row: [
        'guide',
        { col: ['player', { row: ['details', 'comments|chat'] }] },
        'videos|stats|history|settings|log',
      ],
    });
    expect(next.sizes[0]).toBeCloseTo(0.15);
    expect(next.sizes[1]).toBeCloseTo(0.85 * 0.66);
    const moved = addEdge(watch(), 'log', 'left', 0.2);
    expect(L.paneOfView(moved, 'log')?.tabs).toEqual(['log']);
    expect(L.views(moved).filter((v) => v === 'log')).toHaveLength(1);
  });
  it('retainViews drops unknown and duplicate views; parse round-trips', () => {
    const root = L.split('row', [L.pane(['a', 'x']), L.pane(['a', 'b'])]);
    expect(shape(L.retainViews(root, new Set(['a', 'b']))!)).toEqual({ row: ['a', 'b'] });
    const preset = watch();
    expect(parseLayout(JSON.parse(JSON.stringify(preset)))).toEqual(preset);
    expect(parseLayout({ type: 'split', id: 'x', dir: 'diag', children: [] })).toBeNull();
  });
  it('insertAt picks the gap nearest the pointer', () => {
    const tab = (left: number) => ({ left, width: 50, right: left + 50 }) as DOMRect;
    const tabs = [tab(0), tab(50), tab(100)];
    expect(insertAt(tabs, 10)).toEqual([0, 0]);
    expect(insertAt(tabs, 60)).toEqual([1, 50]);
    expect(insertAt(tabs, 140)).toEqual([3, 150]);
    expect(insertAt([], 5)).toEqual([0, 0]);
  });
  it('zoneAt maps pointer position to drop zones', () => {
    const r = { left: 0, top: 0, width: 400, height: 400, right: 400, bottom: 400 } as DOMRect;
    expect(zoneAt(r, 200, 10)).toBe('center');
    expect(zoneAt(r, 20, 200)).toBe('left');
    expect(zoneAt(r, 390, 200)).toBe('right');
    expect(zoneAt(r, 200, 380)).toBe('bottom');
    expect(zoneAt(r, 200, 200)).toBe('center');
  });
  it('a pane added beside siblings takes an equal share; small siblings keep their size', () => {
    const [a, b] = [L.pane(['a']), L.pane(['b'])];
    const even = L.addView(L.split('row', [a, b]), b.id, 'c', 'right') as L.SplitNode;
    expect(shape(even)).toEqual({ row: ['a', 'b', 'c'] });
    for (const z of even.sizes) expect(z).toBeCloseTo(1 / 3);
    const guide = L.addView(L.split('row', [a, b], [0.15, 0.85]), b.id, 'c', 'left') as L.SplitNode;
    expect(shape(guide)).toEqual({ row: ['a', 'c', 'b'] });
    expect(guide.sizes[0]).toBeCloseTo(0.15);
    expect(guide.sizes[1]).toBeCloseTo(1 / 3);
    const down = L.addView(L.split('row', [a, b]), b.id, 'c', 'bottom') as L.SplitNode;
    expect(shape(down)).toEqual({ row: ['a', { col: ['b', 'c'] }] });
  });
  it('own views open several times: tab ids carry an instance suffix; a tab is replaced in place', () => {
    expect(freshTab('stats', new Set(['log']))).toBe('stats');
    expect(freshTab('stats', new Set(['stats', 'stats~2']))).toBe('stats~3');
    expect(kindOf('recommended~2')).toBe('recommended');
    expect(viewOf('recommended~2')?.title).toBe('Recommended');
    const next = L.replaceView(
      L.split('row', [L.pane(['a', 'new'], 'new'), L.pane(['b'])]),
      'new',
      'c',
    );
    expect(shape(next)).toEqual({ row: ['a|c', 'b'] });
    expect((next as L.SplitNode).children[0]).toMatchObject({ active: 'c' });
  });
  it('the watch preset has the optional Playlist tab in front of Recommended, and no Videos', () => {
    const tabs = L.paneOfView(watchPreset(), 'recommended')?.tabs;
    expect(tabs?.slice(0, 2)).toEqual(['playlist', 'recommended']);
    expect(L.paneOfView(watchPreset(), 'videos')).toBeUndefined();
    expect(shape(watchPreset())).toEqual({
      row: [
        { col: ['player', { row: ['details', 'comments|chat', 'history'] }] },
        'playlist|recommended|stats|settings|log',
      ],
    });
    expect(viewsOf('watch').find((v) => v.id === 'playlist')?.optional).toBe(true);
  });
});
