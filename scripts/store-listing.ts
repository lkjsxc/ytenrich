// The store listing as the repository holds it: the summary is the manifest description
// (src/_locales/en/messages.json), the rest lives in store/ and PRIVACY.md. pnpm check tests it; submit-store.ts
// sends it to AMO with each release. The Chrome and Edge APIs take packages only, so for them the release run
// prints the changed text to paste (`dashboard`). `node scripts/store-listing.ts` previews everything.
import { readFileSync } from 'node:fs';
import { json } from './store-api.ts';

export const HOMEPAGE = 'https://github.com/lkjsxc/ytenrich';
export const SUMMARY_MAX = 132; // Chrome's limit for the manifest description (AMO allows 250)
export const DESCRIPTION_MAX = 10_000; // the smallest of the stores' limits (Edge)

export type Listing = {
  readonly summary: string;
  readonly description: string;
  readonly notes: { readonly version: string; readonly text: string };
  readonly reviewer: string;
  readonly privacy: string;
};

const read = (path: string): string => readFileSync(path, 'utf8').trim();

/** The newest section of store/release-notes.md (`## <version>` headings, newest first). */
export function releaseNotes(md: string): { version: string; text: string } {
  const [, newest = ''] = md.split(/^## /m);
  const [version = '', ...lines] = newest.split('\n');
  return { version: version.trim(), text: lines.join('\n').trim() };
}

/** Markdown as the plain text AMO shows (its privacy policy field has no markdown). */
export function plainText(md: string): string {
  return md
    .replace(/^#+\s*/gm, '')
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1 ($2)')
    .replace(/^- /gm, '• ')
    .trim();
}

export function listing(): Listing {
  const messages = JSON.parse(read('src/_locales/en/messages.json')) as {
    description: { message: string };
  };
  return {
    summary: messages.description.message,
    description: read('store/description.txt'),
    notes: releaseNotes(read('store/release-notes.md')),
    reviewer: read('store/reviewer-notes.txt'),
    privacy: plainText(read('PRIVACY.md')),
  };
}

type Amo = (url: string, init?: RequestInit) => Promise<Response>;

/** Puts the listing on AMO: summary, description, homepage, privacy policy, and this version's release notes. */
export async function syncFirefoxListing(amo: Amo, addon: string, version: string): Promise<void> {
  const l = listing();
  if (l.notes.version !== version)
    throw new Error(`store/release-notes.md starts with ${l.notes.version}, not ${version}.`);
  const { default_locale: locale } = await json<{ default_locale: string }>(amo(addon));
  const text = (value: string) => ({ [locale]: value });
  const patch = (url: string, body: object) =>
    amo(url, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  await patch(addon, {
    summary: text(l.summary),
    description: text(l.description),
    homepage: text(HOMEPAGE),
  });
  await patch(`${addon}eula_policy/`, { privacy_policy: text(l.privacy) });
  await patch(`${addon}versions/v${version}/`, { release_notes: text(l.notes.text) });
  console.log(`Firefox listing (${locale}) now matches the repository, with the ${version} notes.`);
}

/** Markdown for the release run's summary: the text to paste into the Chrome and Edge dashboards. */
export function dashboard(since: string): string {
  const l = listing();
  const fence = (s: string) => `\`\`\`text\n${s}\n\`\`\``;
  return [
    `## Store listing text changed${since ? ` since ${since}` : ''}`,
    'AMO (Firefox) was updated by this release. The Chrome and Edge APIs take packages only: paste the description into the Chrome Web Store dashboard (Store listing) and Edge Partner Center (Store listings). The summary ships in the package; Edge asks for it as the short description.',
    '### Description',
    fence(l.description),
    '### Summary',
    fence(l.summary),
    '',
  ].join('\n\n');
}

if (process.argv[1]?.endsWith('store-listing.ts')) {
  const [mode, since = ''] = process.argv.slice(2);
  const l = listing();
  if (mode === 'notes') console.log(l.notes.text);
  else if (mode === 'dashboard') console.log(dashboard(since));
  else {
    for (const [name, value] of Object.entries(l)) {
      const shown = typeof value === 'string' ? value : `${value.version}\n${value.text}`;
      console.log(`--- ${name} (${shown.length} chars)\n${shown}\n`);
    }
  }
}
