import { describe, expect, it } from 'vitest';
import * as L from '../src/wm/layout.ts';
import { watchPreset } from '../src/wm/presets.ts';
import { zoneAt } from '../src/wm/tab-drag.ts';

const shape = (n: L.LayoutNode): unknown =>
  n.type === 'pane' ? n.tabs.join('|') : { [n.dir]: n.children.map(shape) };

describe('layout', () => {
  it('preset has player, details stack and recommendations', () => {
    expect(shape(watchPreset())).toEqual({
      row: [{ col: ['player', 'details|comments|panels'] }, 'videos|shorts|stats|settings|log'],
    });
  });
  it('moves a tab to a pane edge, splitting it, and flattens same-direction splits', () => {
    const root = watchPreset();
    const right = L.paneOfView(root, 'videos')!;
    const next = L.moveView(root, 'stats', right.id, 'right');
    expect(shape(next)).toEqual({
      row: [{ col: ['player', 'details|comments|panels'] }, 'videos|shorts|settings|log', 'stats'],
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
      row: ['details|comments|panels', 'videos|shorts|stats|settings|log'],
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
  it('retainViews drops unknown and duplicate views; parse round-trips', () => {
    const root = L.split('row', [L.pane(['a', 'x']), L.pane(['a', 'b'])]);
    expect(shape(L.retainViews(root, new Set(['a', 'b']))!)).toEqual({ row: ['a', 'b'] });
    const preset = watchPreset();
    expect(L.parseLayout(JSON.parse(JSON.stringify(preset)))).toEqual(preset);
    expect(L.parseLayout({ type: 'split', id: 'x', dir: 'diag', children: [] })).toBeNull();
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
