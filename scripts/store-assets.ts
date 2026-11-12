// Store listing assets → release/store/: 1280x800 screenshots (light + dark), 440x280 promo tile,
// 300px logo (Edge) and 128px icon. Screenshots come from live YouTube (signed out). Usage: pnpm store-assets [--branding-only]
import { mkdirSync, readFileSync } from 'node:fs';
import sharp from 'sharp';
import { launch } from './smoke-lib.ts';

const out = 'release/store';
mkdirSync(out, { recursive: true });
await sharp('src/icon.svg').resize(300).png().toFile(`${out}/logo-300.png`);
await sharp('src/icon.svg').resize(128).png().toFile(`${out}/icon-128.png`);
const icon = readFileSync('src/icon.svg', 'utf8').replace(/<\/?svg[^>]*>/g, '');
const text = (y: number, size: number, fill: string, s: string, weight = 400): string =>
  `<text x="186" y="${y}" font-family="Roboto, Noto Sans, Arial, sans-serif" font-size="${size}" font-weight="${weight}" fill="${fill}">${s}</text>`;
const promo = `<svg xmlns="http://www.w3.org/2000/svg" width="440" height="280">
<rect width="440" height="280" fill="#241019"/><g transform="translate(34 76)">${icon}</g>
${text(122, 40, '#FFF8FA', 'ytenrich', 700)}${text(156, 17, '#F8BCCB', 'Every YouTube page, tiled')}
${text(180, 17, '#E4C8D1', 'Recommendation stats')}${text(204, 17, '#E4C8D1', 'One-click “Not interested”')}</svg>`;
await sharp(Buffer.from(promo)).png().toFile(`${out}/promo-440x280.png`);

// Refresh branding without recapturing the existing listing screenshots.
if (process.argv.includes('--branding-only')) {
  console.log(`ok ${out} branding`);
  process.exit(0);
}

const shot = { width: 1280, height: 800 };
for (const dark of [false, true]) {
  const theme = dark ? 'dark' : 'light';
  const { ctx, page, welcome } = await launch(
    { statsEnabled: true },
    // No autoplay: no ads start, the player shows its poster.
    { ...shot, dark, args: ['--autoplay-policy=document-user-activation-required'] },
  );
  // YouTube's own preferences: English UI, US region, dark theme (f6=400) when wanted.
  const pref = `hl=en&gl=US${dark ? '&f6=400' : ''}`;
  await ctx.addCookies([{ name: 'PREF', value: pref, domain: '.youtube.com', path: '/' }]);
  // Promo popups (mealbar, dialogs) are not part of the product.
  const clean = () =>
    page.addStyleTag({
      content:
        'ytd-mealbar-promo-renderer, tp-yt-paper-dialog, ytd-ad-slot-renderer, ytd-in-feed-ad-layout-renderer, ' +
        'ytd-search-pyv-renderer, ytd-promoted-sparkles-web-renderer, ytd-banner-promo-renderer { display: none !important; }',
    });
  if (!dark) await welcome?.screenshot({ path: `${out}/4-welcome-consent.png` });
  await welcome?.close();
  await page.goto('https://www.youtube.com/watch?v=dQw4w9WgXcQ', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(9000);
  await clean();
  await page.screenshot({ path: `${out}/1-watch-${theme}.png` });
  await page.goto('https://www.youtube.com/results?search_query=lofi+hip+hop', {
    waitUntil: 'domcontentloaded',
  });
  await page.waitForTimeout(7000);
  await clean();
  await page.screenshot({ path: `${out}/2-search-${theme}.png` });
  // Stats in the wide page pane of a browse page: no player (or pre-roll ad) in the shot.
  await page.locator('ytenrich-root .tab[data-view=stats]').click();
  await page.waitForTimeout(2500);
  await clean();
  await page.screenshot({ path: `${out}/3-stats-${theme}.png` });
  await ctx.close();
}
console.log(`ok ${out}`);
