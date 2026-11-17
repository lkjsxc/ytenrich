// Live smoke for tiling on non-watch pages (search, channel) and switching layout families via SPA navigation.
import assert from 'node:assert/strict';
import { launch, rect, tabs } from './smoke-lib.ts';

// Keep the opt-out's original family-switch behavior under test; session smokes cover the new default.
const {
  ctx,
  page,
  sw,
  errors,
  welcome: openWelcome,
  installed,
} = await launch({
  sessionPlayback: false,
});
try {
  // The welcome page states what is recorded, and its switch turns stats off and on again.
  const consent = { installed, before: false, after: false };
  {
    const welcome = await openWelcome();
    await welcome.waitForLoadState();
    const on = () =>
      sw.evaluate(
        async () =>
          ((await chrome.storage.local.get('settings')).settings as { statsEnabled?: boolean })
            ?.statsEnabled !== false,
      );
    consent.before = await on();
    await welcome.screenshot({ path: 'tmp/smoke-welcome.png' });
    // Settings store only overrides; an absent flag means the default is on.
    await welcome.locator('button:has-text("Turn stats off")').click();
    await welcome.waitForTimeout(500);
    consent.after = (await welcome.locator('button:has-text("Turn stats on")').count()) === 1;
    assert(consent.after, 'The welcome switch offers to turn statistics back on');
    assert.equal(await on(), false);
    await welcome.locator('button:has-text("Turn stats on")').click();
    await welcome.waitForTimeout(300);
    assert.equal(await on(), true);
    await welcome.close();
  }
  const pageFacts = async () => ({
    tabs: await tabs(page),
    tag: await page.evaluate(() =>
      document.querySelector('[ytenrich-slot=page]')?.tagName.toLowerCase(),
    ),
    slot: await rect(page, '[ytenrich-slot=page]'),
    body: await rect(page, 'shadow:.body[data-view=page]'),
    guide:
      (await rect(page, '[ytenrich-slot=guide]')) ===
      (await rect(page, 'shadow:.body[data-view=guide]')),
  });
  const checkPage = (facts: Awaited<ReturnType<typeof pageFacts>>, label: string): void => {
    assert(facts.slot, `${label}: Page exists`);
    assert.equal(facts.slot, facts.body, `${label}: Page fills its tile`);
    assert(facts.tabs.split('|').includes('page'), `${label}: Page tab is present`);
  };
  // Search can mix classic renderers and new lockups; count each native watch ID once.
  const nativeWatch = '[ytenrich-slot=page] a[href^="/watch?"]';
  const count = () =>
    page
      .locator(nativeWatch)
      .evaluateAll(
        (links) =>
          new Set(
            links
              .map((link) => new URL((link as HTMLAnchorElement).href).searchParams.get('v'))
              .filter(Boolean),
          ).size,
      );
  const scrollPage = (to: 'end' | 0) =>
    page.evaluate((t) => {
      const s = document.querySelector('[ytenrich-slot=page]');
      s?.scrollTo(0, t === 'end' ? s.scrollHeight : 0);
      return s?.scrollTop ?? -1;
    }, to);

  await page.goto('https://www.youtube.com/results?search_query=lofi+hip+hop', {
    waitUntil: 'domcontentloaded',
  });
  await page.waitForTimeout(7000);
  const search = await pageFacts();
  checkPage(search, 'Search');
  assert.equal(search.tag, 'ytd-search');
  assert(search.guide && (await rect(page, '[ytenrich-slot=guide]')), 'Guide fills its tile');
  await page.screenshot({ path: 'tmp/smoke-browse-search.png' });
  const before = await count();
  assert(before > 0, 'Search contains native watch links');
  for (let i = 0; i < 2; i++) await scrollPage('end'), await page.waitForTimeout(3500);
  const infinite = { before, after: await count() };
  assert(infinite.after > infinite.before, 'Scrolling Page loads additional unique videos');
  // ☰ closes the Guide tile and brings it back.
  await page.click('ytd-masthead #guide-button');
  await page.waitForTimeout(600);
  const guideClosed = await tabs(page);
  assert(!guideClosed.split('|').includes('guide'));
  await page.click('ytd-masthead #guide-button');
  await page.waitForTimeout(1500);
  const guideBack = await tabs(page);
  assert(guideBack.split('|').includes('guide'));
  // Use a native link near the bottom, so Back must reset a genuinely scrolled Page.
  const beforeWatchScroll = await page.evaluate(
    () => document.querySelector('[ytenrich-slot=page]')?.scrollTop ?? 0,
  );
  assert(beforeWatchScroll > 0, 'Search was scrolled before entering watch');
  const origin = await page.evaluate(() => performance.timeOrigin);
  await page.locator(`${nativeWatch}:visible`).last().click();
  await page.waitForURL((url) => url.pathname === '/watch');
  await page.waitForTimeout(6000);
  const watch = { tabs: await tabs(page), player: await rect(page, '[ytenrich-slot=player]') };
  assert(watch.tabs.split('|').includes('player') && watch.player, 'Watch has a Player tile');
  assert.equal(watch.player, await rect(page, 'shadow:.body[data-view=player]'));
  assert.equal(
    await page.evaluate(() => performance.timeOrigin),
    origin,
    'Native link uses SPA navigation',
  );
  await page.goBack();
  await page.waitForURL((url) => url.pathname === '/results');
  await page.waitForTimeout(4000);
  const back = {
    ...(await pageFacts()),
    scrollTop: await page.evaluate(() => document.querySelector('[ytenrich-slot=page]')?.scrollTop),
  };
  checkPage(back, 'Back');
  assert.equal(back.tag, search.tag);
  assert.equal(back.scrollTop, 0, 'Back restores Page at its top');
  assert(!back.tabs.split('|').includes('player'), 'Opt-out restores the browse family');
  assert.equal(await rect(page, '[ytenrich-slot=player]'), null);
  await page.goto('https://www.youtube.com/@YouTube/videos', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(7000);
  const channel = {
    ...(await pageFacts()),
    header: await rect(page, '[ytenrich-slot=page] tp-yt-app-header'),
  };
  checkPage(channel, 'Channel');
  assert.equal(channel.tag, 'ytd-browse');
  // Home's frosted-glass band (signed in only) must not cover the tab strips: force its mode and hit-test the strip.
  const frostedCovered = await page.evaluate(() => {
    const f = document.querySelector('ytd-app #frosted-glass');
    f?.classList.replace('none', 'with-chipbar');
    return document.elementFromPoint(400, 70)?.tagName.toLowerCase() !== 'ytenrich-root';
  });
  assert.equal(frostedCovered, false, 'Native frosted glass leaves the tile tabs clickable');
  await page.screenshot({ path: 'tmp/smoke-browse-channel.png' });
  console.log(
    JSON.stringify(
      {
        consent,
        search,
        infinite,
        guideClosed,
        guideBack,
        beforeWatchScroll,
        watch,
        back,
        channel,
        frostedCovered,
        errors,
      },
      null,
      1,
    ),
  );
  assert.deepEqual(errors, [], 'No extension errors or unexpected warnings');
} catch (error) {
  console.error(JSON.stringify({ url: page.url(), errors }));
  throw error;
} finally {
  await ctx.close();
}
