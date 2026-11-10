// Shared launcher for live smokes: Chromium (Playwright's, else newest cached, or YTE_CHROME) + unpacked dist/.
import { existsSync, mkdirSync, mkdtempSync, readdirSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { chromium, type Page } from 'playwright';

const cached = (): string | undefined => {
  const root = join(homedir(), '.cache/ms-playwright');
  const dirs = existsSync(root)
    ? readdirSync(root)
        .filter((d) => /^chromium-\d+$/.test(d))
        .sort()
        .reverse()
    : [];
  return dirs.map((d) => join(root, d, 'chrome-linux64/chrome')).find(existsSync);
};

export async function launch(settings: Record<string, unknown> = {}) {
  const ext = resolve('dist');
  const exe =
    process.env.YTE_CHROME ?? (existsSync(chromium.executablePath()) ? undefined : cached());
  mkdirSync('tmp', { recursive: true });
  const ctx = await chromium.launchPersistentContext(mkdtempSync(join(tmpdir(), 'yte-')), {
    headless: true,
    ...(exe ? { executablePath: exe } : {}),
    viewport: { width: 1600, height: 1000 },
    locale: 'en-US',
    args: [`--disable-extensions-except=${ext}`, `--load-extension=${ext}`],
  });
  const errors: string[] = [];
  const page = ctx.pages()[0] ?? (await ctx.newPage());
  page.on(
    'console',
    (m) => m.text().includes('ytenrich') && errors.push(`${m.type()}: ${m.text()}`),
  );
  page.on(
    'pageerror',
    (e) => String(e.stack).includes('chrome-extension') && errors.push(String(e)),
  );
  const sw = ctx.serviceWorkers()[0] ?? (await ctx.waitForEvent('serviceworker'));
  await sw.evaluate((s) => chrome.storage.local.set({ settings: s }), settings);
  return { ctx, page, sw, errors };
}

/** "left,top,width,height" of an element (light DOM selector, or `shadow:` prefix for the WM shadow root). */
export const rect = (page: Page, sel: string): Promise<string | null> =>
  page.evaluate((s) => {
    const sh = document.querySelector('ytenrich-root')?.shadowRoot;
    const el = s.startsWith('shadow:') ? sh?.querySelector(s.slice(7)) : document.querySelector(s);
    const b = el?.getBoundingClientRect();
    return b ? [b.left, b.top, b.width, b.height].map(Math.round).join(',') : null;
  }, sel);

export const tabs = (page: Page): Promise<string> =>
  page.evaluate(() =>
    [...(document.querySelector('ytenrich-root')?.shadowRoot?.querySelectorAll('.tab') ?? [])]
      .map((t) => (t as HTMLElement).dataset.view)
      .join('|'),
  );
