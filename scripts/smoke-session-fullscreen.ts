// Native fullscreen can allocate a chat sidebar; use the real player rectangle, not a viewport percentage.
import assert from 'node:assert/strict';

export function assertFullscreenAllocation(
  video: number[],
  player: number[],
  viewport: number[],
): void {
  assert.equal(player.length, 4, 'Fullscreen has an allocated native player');
  assert.equal(video.length, 4, 'Fullscreen media has a measured rectangle');
  assert.equal(viewport.length, 2, 'Fullscreen has a measured viewport');
  assert([...player, ...video, ...viewport].every(Number.isFinite), 'Measured geometry is finite');
  const [x, y, width, height] = player as [number, number, number, number];
  const [vx, vy, vw, vh] = video as [number, number, number, number];
  const [screenWidth, screenHeight] = viewport as [number, number];
  const close = (a: number, b: number): boolean => Math.abs(a - b) <= 2; // native CSS pixel rounding
  assert(width > 0 && height > 0, 'Native fullscreen player has a positive area');
  assert(
    x >= -2 && y >= -2 && x + width <= screenWidth + 2 && y + height <= screenHeight + 2,
    'Native fullscreen allocation stays inside the viewport',
  );
  assert(
    (close(x, 0) && close(width, screenWidth)) || (close(y, 0) && close(height, screenHeight)),
    'Native fullscreen player spans a viewport dimension; a stale tiled rectangle does not',
  );
  assert(
    vx >= x - 2 && vy >= y - 2 && vx + vw <= x + width + 2 && vy + vh <= y + height + 2,
    'Decoded fullscreen video remains inside its native allocation',
  );
  assert(
    close(vw, width) || close(vh, height),
    'Video fills one native player dimension, allowing ordinary letterboxing and chat',
  );
}
