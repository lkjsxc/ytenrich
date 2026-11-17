// MAIN world: one measured miniplayer projection. Native delayed resize writes can follow the window event.
type Player = Element & {
  getPlayerSize?: () => { width: number; height: number };
  setInternalSize?: (width: number, height: number) => void;
};
let current: { slot: HTMLElement; player: Player } | undefined; // bound: the one projected player
let frame = 0;
const observer = new MutationObserver(() => {
  frame ||= requestAnimationFrame(refit);
});
const eligible = (slot: HTMLElement): boolean =>
  !document.fullscreenElement &&
  document.documentElement.hasAttribute('ytenrich-wm') &&
  slot.isConnected &&
  slot.matches('ytd-miniplayer [ytenrich-slot=player]:not([ytenrich-slot-inactive])');
const clear = (): void => {
  observer.disconnect();
  cancelAnimationFrame(frame);
  frame = 0;
  current = undefined;
};
function refit(): void {
  frame = 0;
  if (!current || !eligible(current.slot) || !current.slot.contains(current.player)) {
    clear();
    return;
  }
  const { slot, player } = current;
  const { width, height } = slot.getBoundingClientRect();
  if (!width || !height) return;
  try {
    const size = player.getPlayerSize?.();
    const w = Math.round(width),
      h = Math.round(height);
    if (size && (size.width !== w || size.height !== h)) player.setInternalSize?.(w, h);
  } catch {
    clear(); // An unsupported native API leaves the CSS-fitted media alone.
  }
}

document.addEventListener('ytenrich-player-resize', (event) => {
  const slot = event.target;
  if (!(slot instanceof HTMLElement) || !eligible(slot)) return;
  const player = slot.querySelector<Player>('#movie_player');
  if (typeof player?.setInternalSize !== 'function' || typeof player.getPlayerSize !== 'function')
    return;
  clear();
  current = { slot, player };
  const video = player.querySelector('video');
  // Observe just native media-size writes and tiling shutdown, never poll or observe the whole page's styles.
  if (video) observer.observe(video, { attributes: true, attributeFilter: ['style'] });
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['ytenrich-wm'],
  });
  refit();
});
