// Shared launcher for live smokes: Chromium (Playwright's, else newest cached, or YTE_CHROME) + unpacked dist/.
import { execFileSync } from 'node:child_process';
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

/** `desktopUa`: drop "Headless" from the user agent (YouTube Music turns headless Chromium away). */
export type LaunchOpts = {
  width?: number;
  height?: number;
  dark?: boolean;
  args?: string[];
  desktopUa?: boolean;
};

const desktopUa = (exe: string): string => {
  const major = /(\d+)\./.exec(execFileSync(exe, ['--version'], { encoding: 'utf8' }))?.[1];
  return `--user-agent=Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${major}.0.0.0 Safari/537.36`;
};

export async function launch(settings: Record<string, unknown> = {}, opts: LaunchOpts = {}) {
  const ext = resolve('dist');
  const exe =
    process.env.YTE_CHROME ?? (existsSync(chromium.executablePath()) ? undefined : cached());
  mkdirSync('tmp', { recursive: true });
  const ctx = await chromium.launchPersistentContext(mkdtempSync(join(tmpdir(), 'yte-')), {
    headless: true,
    ...(exe ? { executablePath: exe } : {}),
    viewport: { width: opts.width ?? 1600, height: opts.height ?? 1000 },
    colorScheme: opts.dark ? 'dark' : 'light',
    locale: 'en-US',
    args: [
      `--disable-extensions-except=${ext}`,
      `--load-extension=${ext}`,
      ...(opts.desktopUa ? [desktopUa(exe ?? chromium.executablePath())] : []),
      ...(opts.args ?? []),
    ],
  });
  const errors: string[] = [];
  const page = ctx.pages().find((p) => p.url() === 'about:blank') ?? (await ctx.newPage());
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
  // First install opens YouTube in its own tab (the welcome card lives there); the smokes drive `page` instead.
  const isInstall = (p: Page): boolean =>
    p !== page && p.url().startsWith('https://www.youtube.com');
  const installTab =
    ctx.pages().find(isInstall) ??
    (await ctx
      .waitForEvent('page', { predicate: isInstall, timeout: 4000 })
      .catch(() => undefined));
  await installTab?.close();
  await page.bringToFront(); // background tabs pause rAF, and the projector schedules with it
  const extId = new URL(sw.url()).host;
  /** The welcome page, which install no longer opens (store screenshots, consent smoke). */
  const welcome = async (): Promise<Page> => {
    const p = await ctx.newPage();
    await p.goto(`chrome-extension://${extId}/options.html#welcome`);
    return p;
  };
  return { ctx, page, sw, errors, welcome, installed: Boolean(installTab) };
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
