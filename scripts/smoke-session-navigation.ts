// Completion markers separate a native SPA route change from its reused, not-yet-updated Page element.
import assert from 'node:assert/strict';
import type { Page } from 'playwright';

export const installNavigationProof = (page: Page) =>
  page.addInitScript(() =>
    document.addEventListener('yt-navigate-finish', () => {
      document.documentElement.setAttribute('data-ytenrich-smoke-nav', location.href);
    }),
  );

export const startNavigation = (page: Page) =>
  page.evaluate(() => document.documentElement.removeAttribute('data-ytenrich-smoke-nav'));

export const finishNavigation = (page: Page) =>
  page.waitForFunction(
    () => document.documentElement.getAttribute('data-ytenrich-smoke-nav') === location.href,
  );

export async function nativeSearch(page: Page, query: string): Promise<void> {
  await startNavigation(page);
  const field = page.locator('ytd-masthead input[name=search_query]');
  await field.fill(query);
  await field.press('Enter');
  await page.waitForURL(
    (url) => url.pathname === '/results' && url.searchParams.get('search_query') === query,
  );
  await finishNavigation(page);
  await page.locator('ytd-search[ytenrich-slot=page]').waitFor();
}

export async function nativeHome(page: Page): Promise<void> {
  await startNavigation(page);
  await page.locator('ytd-masthead a#logo').click();
  await page.waitForURL((url) => url.pathname === '/');
  await finishNavigation(page);
  await page.locator('ytd-browse[page-subtype=home][ytenrich-slot=page]').waitFor();
}

/** Use YouTube's actual search-filter endpoint; ordinary keyword results need not contain any playlists. */
export async function nativeFilter(page: Page, label: string): Promise<void> {
  await page.getByRole('button', { name: 'Search filters', exact: true }).click();
  const link = page.locator('ytd-search-filter-renderer a').filter({ hasText: label }).first();
  const href = await link.getAttribute('href');
  assert(href, 'The native filter has a destination');
  await startNavigation(page);
  await link.click();
  await page.waitForURL(new URL(href, page.url()).href);
  await finishNavigation(page);
}
