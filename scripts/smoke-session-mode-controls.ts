// Native fullscreen controls and the real Settings opt-out, used only by the live mode smoke.
import assert from 'node:assert/strict';
import type { Page, Worker } from 'playwright';
import { rect } from './smoke-lib.ts';
import { assertStopped } from './smoke-session-lib.ts';
import type { createModeProof } from './smoke-session-modes-lib.ts';

type Proof = Awaited<ReturnType<typeof createModeProof>>;

export async function fullscreenRoundTrip(
  page: Page,
  proof: Proof,
  label: string,
  optional = false,
): Promise<unknown[]> {
  await page.locator('#movie_player').hover();
  const selector = '#movie_player .ytp-fullscreen-button';
  const present = await page.locator(selector).count();
  const button = page.locator(`${selector}:visible`).first();
  const visible = (await button.count()) > 0;
  const enabled = visible && (await button.isEnabled());
  if (!enabled) {
    assert(optional, `${label}: a visible enabled native fullscreen control is required`);
    return [
      {
        label,
        tested: false,
        nativeControl: { present, visible, enabled },
        reason: 'The native miniplayer offers no visible enabled fullscreen button.',
      },
      await proof.check(`${label}: retained playback without a fullscreen control`),
    ];
  }
  const before = page.url();
  await button.click();
  await page.waitForFunction(
    () => document.fullscreenElement && !document.documentElement.hasAttribute('ytenrich-wm'),
  );
  const entered = await proof.check(label, true);
  await page.screenshot({ path: `tmp/smoke-session-${label.replace(/\W+/g, '-')}.png` });
  await page.locator('#movie_player').hover();
  await page.locator(`${selector}:visible`).first().click();
  await page.waitForFunction(
    () => !document.fullscreenElement && document.documentElement.hasAttribute('ytenrich-wm'),
  );
  const restored = await proof.check(`${label} restored`);
  return [entered, { ...restored, urlBefore: before, nativeRouteChange: page.url() !== before }];
}

export const patchSettings = (sw: Worker, patch: Record<string, unknown>) =>
  sw.evaluate(async (patch) => {
    const stored = await chrome.storage.local.get('settings');
    await chrome.storage.local.set({
      settings: {
        ...(stored.settings as Record<string, unknown>),
        ...patch,
      },
    });
  }, patch);

export async function noTwoSounds(page: Page): Promise<number> {
  const audible = await page.evaluate(
    () =>
      [...document.querySelectorAll('video')].filter(
        (v) => !v.paused && !v.ended && !v.muted && v.volume > 0,
      ).length,
  );
  assert(audible <= 1, 'Never two audible videos');
  return audible;
}

async function normalHome(page: Page): Promise<void> {
  assert.equal(new URL(page.url()).pathname, '/');
  await page.locator('html[ytenrich-wm] ytenrich-root').waitFor();
  for (const name of ['guide', 'recommended', 'recommended-shorts'])
    await page.locator(`ytenrich-root .tab[data-view="${name}"]`).waitFor();
  assert.equal(await page.locator('ytenrich-root .tab[data-view=page]').count(), 0);
  const body = page.locator('ytenrich-root .body[data-view=recommended]');
  await body.waitFor();
  const box = await body.boundingBox();
  assert(box && box.width > 0 && box.height > 0, 'The ordinary Home view is visible');
}

/** A stopped player must leave the current search usable, not an absent WM or an empty Page rectangle. */
export async function functionalSearch(page: Page) {
  assert.equal(new URL(page.url()).pathname, '/results');
  await page.locator('html[ytenrich-wm] ytenrich-root').waitFor();
  const tile = page.locator(
    'ytd-search[ytenrich-slot=page]:not([hidden], [ytenrich-slot-inactive])',
  );
  await tile.waitFor();
  assert.equal(
    await rect(page, '[ytenrich-slot=page]'),
    await rect(page, 'shadow:.body[data-view=page]'),
  );
  const state = await tile.evaluate((element) => {
    const before = element.scrollTop;
    const max = element.scrollHeight - element.clientHeight;
    const target = before < max ? Math.min(max, before + 120) : Math.max(0, before - 120);
    element.scrollTo({ top: target, behavior: 'instant' });
    const moved = Math.abs(element.scrollTop - before);
    element.scrollTo({ top: before, behavior: 'instant' });
    return {
      width: element.clientWidth,
      height: element.clientHeight,
      links: element.querySelectorAll('a[href]').length,
      scrollable: max > 0,
      moved,
    };
  });
  assert(
    state.width > 0 && state.height > 0 && state.links > 0,
    'Search has visible content and links',
  );
  if (state.scrollable) assert(state.moved > 0, 'The native Page tile still scrolls');
  return state;
}

/** Use the checkbox the user sees; after the family changes, reopen Settings and verify the stored off value. */
export async function disableThroughSettings(page: Page, sw: Worker) {
  const checkbox = async () => {
    await page.locator('ytenrich-root .tab[data-view=settings]').click();
    const settings = page.locator('ytenrich-root .body[data-view=settings]');
    await settings.getByPlaceholder('Search settings').fill('sessionPlayback');
    const input = settings.locator('.sitem:not([hidden]) input[type=checkbox]');
    assert.equal(await input.count(), 1, 'The session setting has one checkbox');
    return input;
  };
  const on = await checkbox();
  assert(await on.isChecked(), 'The setting starts enabled');
  await on.click(); // the family switch removes this control; do not inspect that detached instance
  await assertStopped(page);
  const stored = await sw.evaluate(async () => {
    const data = await chrome.storage.local.get('settings');
    return (data.settings as { sessionPlayback?: boolean })?.sessionPlayback;
  });
  assert.equal(stored, false, 'The checkbox persisted the opt-out');
  await normalHome(page);
  assert.equal(
    await (await checkbox()).isChecked(),
    false,
    'Reopened Settings still shows the opt-out',
  );
  await page.locator('ytenrich-root .tab[data-view=recommended]').click();
  await normalHome(page);
  return { persisted: stored, checkboxChecked: false, normalHome: true };
}
