// Only the live-mode scenario skips a native pre-roll; the core session smoke retains and verifies ads.
import type { Page } from 'playwright';

export const finishLiveAd = (page: Page) =>
  page.evaluate(
    () =>
      new Promise<void>((resolve, reject) => {
        const player = document.querySelector('#movie_player');
        if (!player) return reject(new Error('The selected live player is missing'));
        let frame = 0;
        let clicked: HTMLElement | null = null; // bound: one native Skip button and its current media source
        let source = '';
        const finish = (error?: Error): void => {
          clearTimeout(timer);
          cancelAnimationFrame(frame);
          observer.disconnect();
          error ? reject(error) : resolve();
        };
        const inspect = (): void => {
          frame = 0;
          if (!player.isConnected) {
            finish(new Error('The live player detached during pre-roll'));
            return;
          }
          if (!player.classList.contains('ad-showing')) {
            finish();
            return;
          }
          const button = [
            ...player.querySelectorAll<HTMLButtonElement>('.ytp-skip-ad-button'),
          ].find((candidate) => {
            if (candidate.disabled || candidate.getAttribute('aria-disabled') === 'true')
              return false;
            const r = candidate.getBoundingClientRect();
            return (
              candidate.checkVisibility({ visibilityProperty: true, opacityProperty: true }) &&
              r.width > 0 &&
              r.height > 0 &&
              r.bottom > 0 &&
              r.right > 0 &&
              r.left < innerWidth &&
              r.top < innerHeight
            );
          });
          if (!button) return;
          const current = player.querySelector('video')?.currentSrc ?? '';
          if (button === clicked && current === source) return;
          clicked = button;
          source = current;
          button.click();
        };
        const observer = new MutationObserver(() => {
          frame ||= requestAnimationFrame(inspect);
        });
        const timer = setTimeout(
          () => finish(new Error('The native live pre-roll did not finish within 90 seconds')),
          90_000,
        );
        observer.observe(player, {
          attributes: true,
          attributeFilter: ['class', 'style', 'disabled', 'aria-disabled'],
          childList: true,
          subtree: true,
        });
        inspect();
      }),
  );
