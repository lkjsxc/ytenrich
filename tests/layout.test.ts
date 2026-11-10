import { describe, expect, it } from 'vitest';
import { viewsOf } from '../src/views/registry.ts';
import * as L from '../src/wm/layout.ts';
import { parseLayout } from '../src/wm/layout-parse.ts';
import { browsePreset, familyOf, watchPreset } from '../src/wm/presets.ts';
import { insertAt, zoneAt } from '../src/wm/tab-drag.ts';

const shape = (n: L.LayoutNode): unknown =>
  n.type === 'pane' ? n.tabs.join('|') : { [n.dir]: n.children.map(shape) };

describe('layout', () => {
  it('preset has player over details | comments, and recommendations', () => {
    expect(shape(watchPreset())).toEqual({
      row: [{ col: ['player', { row: ['details', 'comments'] }] }, 'videos|stats|settings|log'],
    });
  });
  it('browse preset: guide beside the page; every preset view exists in its family', () => {
    const b = browsePreset(1600) as L.SplitNode;
    expect(shape(b)).toEqual({ row: ['guide', 'page|stats|settings|log'] });
    expect(b.sizes[0]).toBeCloseTo(0.15);
    for (const [family, preset] of [
      ['browse', b],
      ['watch', watchPreset()],
    ] as const) {
      const known = new Set(viewsOf(family).map((v) => v.id));
      expect(L.views(preset).filter((v) => !known.has(v))).toEqual([]);
    }
    expect(viewsOf('browse').some((v) => v.id === 'player')).toBe(false);
  });
  it('page kinds map to layout families (Shorts keeps YouTube UI)', () => {
    expect(
      ['watch', 'home', 'search', 'channel', 'subs', 'other', 'shorts'].map((k) =>
        familyOf(k as never),
      ),
    ).toEqual(['watch', 'browse', 'browse', 'browse', 'browse', 'browse', null]);
  });
  it('moves a tab to a pane edge, splitting it, and flattens same-direction splits', () => {
    const root = watchPreset();
    const right = L.paneOfView(root, 'videos')!;
    const next = L.moveView(root, 'stats', right.id, 'right');
    expect(shape(next)).toEqual({
      row: [{ col: ['player', { row: ['details', 'comments'] }] }, 'videos|settings|log', 'stats'],
    });
    const s = next as L.SplitNode;
    expect(s.sizes.reduce((a, b) => a + b, 0)).toBeCloseTo(1);
    expect(s.sizes[0]).toBeCloseTo(0.66);
  });
  it('moving the only tab of a pane to its own edge is a no-op', () => {
    const root = watchPreset();
    const p = L.paneOfView(root, 'player')!;
    expect(shape(L.moveView(root, 'player', p.id, 'left'))).toEqual(shape(root));
  });
  it('removing the last tab removes the pane and collapses the split', () => {
    const root = L.removeView(watchPreset(), 'player')!;
    expect(shape(root)).toEqual({
      row: ['details', 'comments', 'videos|stats|settings|log'],
    });
  });
  it('center drop joins and activates', () => {
    const root = watchPreset();
    const p = L.paneOfView(root, 'player')!;
    const next = L.moveView(root, 'comments', p.id, 'center');
    expect(L.paneOfView(next, 'comments')).toMatchObject({
      tabs: ['player', 'comments'],
      active: 'comments',
    });
  });
  it('reorders tabs within a strip and inserts at an index across panes', () => {
    const root = watchPreset();
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
    const next = L.addEdge(watchPreset(), 'guide', 'left', 0.15) as L.SplitNode;
    expect(shape(next)).toEqual({
      row: [
        'guide',
        { col: ['player', { row: ['details', 'comments'] }] },
        'videos|stats|settings|log',
      ],
    });
    expect(next.sizes[0]).toBeCloseTo(0.15);
    expect(next.sizes[1]).toBeCloseTo(0.85 * 0.66);
    const moved = L.addEdge(watchPreset(), 'log', 'left', 0.2);
    expect(L.paneOfView(moved, 'log')?.tabs).toEqual(['log']);
    expect(L.views(moved).filter((v) => v === 'log')).toHaveLength(1);
  });
  it('retainViews drops unknown and duplicate views; parse round-trips', () => {
    const root = L.split('row', [L.pane(['a', 'x']), L.pane(['a', 'b'])]);
    expect(shape(L.retainViews(root, new Set(['a', 'b']))!)).toEqual({ row: ['a', 'b'] });
    const preset = watchPreset();
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
});
