import { svg } from './h.ts';

// "Not interested" mark, shared by the button on YouTube's tiles and the one in Recommended.
export const dismissIcon = (): SVGElement =>
  svg(
    'svg',
    { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': 2 },
    svg('circle', { cx: 12, cy: 12, r: 8.5 }),
    svg('path', { d: 'M6 6l12 12' }),
  );
