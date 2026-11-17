import { describe, expect, it } from 'vitest';
import * as L from '../src/wm/layout.ts';
import { projectSessionLayout } from '../src/wm/session-layout.ts';

/** Measure every pane independently, including nested row/column splits, in viewport pixels. */
function rectangles(root: L.LayoutNode, box = [0, 0, 1440, 900]): Record<string, number[]> {
  if (root.type === 'pane') return { [root.id]: box };
  const axis = root.dir === 'row' ? 0 : 1;
  const extent = axis + 2;
  let offset = 0;
  return Object.assign(
    {},
    ...root.children.map((child, i) => {
      const next = [...box];
      next[axis] = (box[axis] ?? 0) + offset;
      next[extent] = (box[extent] ?? 0) * (root.sizes[i] ?? 0);
      offset += next[extent] ?? 0;
      return rectangles(child, next);
    }),
  );
}

const sample = (): L.LayoutNode =>
  L.split(
    'row',
    [
      L.split(
        'col',
        [L.pane(['player']), L.split('row', [L.pane(['details']), L.pane(['comments'])])],
        [0.7, 0.3],
      ),
      L.pane(['playlist', 'recommended', 'settings']),
    ],
    [0.66, 0.34],
  );

describe('session layout', () => {
  it('returns the original watch layout and reports whether it has room to browse', () => {
    const root = sample();
    expect(projectSessionLayout(root, false)).toEqual({ layout: root, canBrowse: true });
    expect(projectSessionLayout(root, false).layout).toBe(root);
  });

  it('shows Page beside playback without changing any rectangle or the saved layout', () => {
    const root = sample();
    const saved = JSON.stringify(root);
    const { layout, canBrowse } = projectSessionLayout(root, true);
    expect(canBrowse).toBe(true);
    expect(L.paneOfView(layout, 'page')).toMatchObject({
      id: L.paneOfView(root, 'recommended')?.id,
      active: 'page',
      tabs: ['playlist', 'recommended', 'settings', 'page'],
    });
    expect(rectangles(layout)).toEqual(rectangles(root));
    expect(L.paneOfView(layout, 'player')).toBe(L.paneOfView(root, 'player'));
    expect(L.paneOfView(layout, 'details')).toBe(L.paneOfView(root, 'details'));
    expect(JSON.stringify(root)).toBe(saved);
    expect(projectSessionLayout(root, false).layout).toBe(root);
  });

  it('respects an existing Page pane even when recommendations have more room', () => {
    const page = L.pane(['page', 'history'], 'history');
    const root = L.split(
      'row',
      [L.pane(['player']), page, L.pane(['recommended'])],
      [0.45, 0.15, 0.4],
    );
    const { layout } = projectSessionLayout(root, true);
    expect(L.paneOfView(layout, 'page')).toEqual({ ...page, active: 'page' });
    expect(L.views(layout).filter((view) => view === 'page')).toHaveLength(1);
    expect(rectangles(layout)).toEqual(rectangles(root));
  });

  it('moves Page out of the player pane and restores Player without removing that pane', () => {
    const player = L.pane(['settings', 'player', 'page'], 'page');
    const root = L.split('row', [player, L.pane(['comments'])], [0.8, 0.2]);
    const { layout } = projectSessionLayout(root, true);
    expect(L.paneOfView(layout, 'player')).toEqual({
      ...player,
      tabs: ['settings', 'player'],
      active: 'player',
    });
    expect(L.paneOfView(layout, 'page')?.id).not.toBe(player.id);
    expect(L.views(layout).filter((view) => view === 'page')).toHaveLength(1);
    expect(rectangles(layout)).toEqual(rectangles(root));
    expect(player.active).toBe('page');
  });

  it.each(['recommended~2', 'videos'])('prefers %s over a larger unrelated pane', (view) => {
    const preferred = L.pane([view]);
    const root = L.split(
      'row',
      [L.pane(['player']), L.pane(['comments']), preferred],
      [0.4, 0.45, 0.15],
    );
    expect(L.paneOfView(projectSessionLayout(root, true).layout, 'page')?.id).toBe(preferred.id);
  });

  it('uses full nested area when no Page or recommendations pane exists', () => {
    const broad = L.pane(['comments']);
    const root = L.split(
      'row',
      [L.split('col', [L.pane(['player']), L.pane(['details'])], [0.75, 0.25]), broad],
      [0.7, 0.3],
    );
    const { layout } = projectSessionLayout(root, true);
    expect(L.paneOfView(layout, 'page')?.id).toBe(broad.id);
    expect(rectangles(layout)).toEqual(rectangles(root));
  });

  it.each([
    L.pane(['player']),
    L.pane(['player', 'page']),
    L.split('row', [L.pane(['comments']), L.pane(['page'])]),
  ])('declines unsupported layouts without creating or changing any panes', (root) => {
    for (const browsing of [false, true]) {
      const result = projectSessionLayout(root, browsing);
      expect(result.canBrowse).toBe(false);
      expect(result.layout).toBe(root);
    }
  });

  it('does not duplicate Page or change geometry when projected again', () => {
    const first = projectSessionLayout(sample(), true).layout;
    const second = projectSessionLayout(first, true).layout;
    expect(second).toBe(first);
    expect(L.views(second).filter((view) => view === 'page')).toHaveLength(1);
  });
});
