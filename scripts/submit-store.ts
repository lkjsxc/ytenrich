// Submit the packages produced by pnpm package to the existing ytenrich listings.
import { createHmac, randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { json, request, waitFor } from './store-api.ts';

const notes =
  'Open a YouTube watch page in a normal desktop window. Resize or split panes and use Alt+W to toggle the layout. Open Stats and choose Start recording to test local statistics. To test the Not interested shortcut, use a reviewer-controlled YouTube account and a recommendation with that native menu item.';

function credential(name: string): string {
  const value = process.env[name];
  if (!value?.trim()) throw new Error(`Missing ${name}. See docs/store.md.`);
  return value;
}

type ChromeRevision = { state: string; distributionChannels?: { crxVersion: string }[] };
type ChromeStatus = {
  publishedItemRevisionStatus?: ChromeRevision;
  submittedItemRevisionStatus?: ChromeRevision;
  lastAsyncUploadState?: string;
};

async function chrome(version: string, zip: Uint8Array<ArrayBuffer>): Promise<void> {
  const base = 'https://chromewebstore.googleapis.com';
  const item =
    'publishers/5cfb3629-8c59-4222-a079-86c6035cdbec/items/ikcbajmfmiobffnnimnhojlbpieegijc';
  const headers = { Authorization: `Bearer ${credential('CHROME_ACCESS_TOKEN')}` };
  const status = () => json<ChromeStatus>(request(`${base}/v2/${item}:fetchStatus`, { headers }));
  const current = await status();
  const published = current.publishedItemRevisionStatus;
  const submitted = current.submittedItemRevisionStatus;
  const hasVersion = (revision: ChromeRevision | undefined) =>
    revision?.distributionChannels?.some((channel) => channel.crxVersion === version);
  if (hasVersion(published)) {
    console.log(`Chrome ${version} is already published.`);
    return;
  }
  if (submitted?.state === 'PENDING_REVIEW' || submitted?.state === 'STAGED') {
    if (!hasVersion(submitted)) throw new Error('Another Chrome submission is pending or staged.');
    console.log(`Chrome ${version} is already ${submitted.state}.`);
    return;
  }
  if (!published) throw new Error('Publish the first Chrome version in the dashboard.');
  if (current.lastAsyncUploadState === 'IN_PROGRESS')
    throw new Error('A Chrome upload is already in progress.');

  const uploaded = await json<{ uploadState: string; crxVersion?: string }>(
    request(`${base}/upload/v2/${item}:upload`, {
      method: 'POST',
      headers: { ...headers, 'Content-Type': 'application/zip' },
      body: zip,
    }),
  );
  if (uploaded.uploadState === 'IN_PROGRESS') {
    await waitFor('Chrome upload', async () => {
      const { lastAsyncUploadState: state } = await status();
      if (state === 'FAILED') throw new Error('Chrome rejected the package.');
      return state === 'SUCCEEDED';
    });
  } else if (uploaded.uploadState !== 'SUCCEEDED' || uploaded.crxVersion !== version) {
    throw new Error('Chrome did not confirm an upload for the requested version.');
  }
  const submittedNow = await json<{ state: string }>(
    request(`${base}/v2/${item}:publish`, {
      method: 'POST',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({ publishType: 'DEFAULT_PUBLISH', skipReview: false }),
    }),
  );
  if (!['PENDING_REVIEW', 'PUBLISHED', 'PUBLISHED_TO_TESTERS'].includes(submittedNow.state))
    throw new Error(`Unexpected Chrome submission state: ${submittedNow.state}`);
  console.log(`Chrome ${version}: ${submittedNow.state}`);
}

async function edge(version: string, zip: Uint8Array<ArrayBuffer>): Promise<void> {
  const product = 'fa6ff89a-070c-4f61-983d-01a8ee7a171e';
  const submissions = `https://api.addons.microsoftedge.microsoft.com/v1/products/${product}/submissions`;
  const headers = {
    Authorization: `ApiKey ${credential('EDGE_API_KEY')}`,
    'X-ClientID': credential('EDGE_CLIENT_ID'),
  };
  const operation = async (label: string, url: string, body: BodyInit, contentType: string) => {
    const response = await request(url, {
      method: 'POST',
      headers: { ...headers, 'Content-Type': contentType },
      body,
    });
    const id = response.headers.get('Location')?.trim().split('/').at(-1);
    if (response.status !== 202 || !id || !/^[a-zA-Z0-9-]+$/.test(id))
      throw new Error(`Edge ${label} returned no operation ID. Check Partner Center.`);
    console.log(`Edge ${label} operation: ${id}`);
    await waitFor(`Edge ${label} ${id}`, async () => {
      const result = await json<{ status?: string; errorCode?: string }>(
        request(`${url}/operations/${id}`, { headers }),
      );
      if (result.status === 'InProgress') return false;
      if (result.status === 'Succeeded') return true;
      const code = result.errorCode?.match(/^[a-zA-Z0-9_-]+$/)?.[0] ?? 'unknown error';
      throw new Error(`Edge ${label} failed (${code}). See operation ${id} in Partner Center.`);
    });
  };
  await operation('upload', `${submissions}/draft/package`, zip, 'application/zip');
  await operation('submission', submissions, JSON.stringify({ notes }), 'application/json');
  console.log(`Edge ${version} submitted for certification.`);
}

type FirefoxVersion = {
  version: string;
  file: { status: string };
  source?: string | null;
  is_disabled?: boolean;
};
type FirefoxUpload = { uuid: string; processed: boolean; valid: boolean; version: string };

async function firefox(version: string, prefix: string): Promise<void> {
  const base = 'https://addons.mozilla.org/api/v5/addons';
  const versions = `${base}/addon/${encodeURIComponent('ytenrich@lkjsxc')}/versions/`;
  const iss = credential('AMO_API_KEY');
  const secret = credential('AMO_API_SECRET');
  const encode = (value: object) => Buffer.from(JSON.stringify(value)).toString('base64url');
  const amo = (url: string, init?: RequestInit) => {
    const iat = Math.floor(Date.now() / 1000);
    const claims = encode({ iss, jti: randomUUID(), iat, exp: iat + 60 });
    const data = `${encode({ alg: 'HS256', typ: 'JWT' })}.${claims}`;
    const signature = createHmac('sha256', secret).update(data).digest('base64url');
    return request(url, { ...init, headers: { Authorization: `JWT ${data}.${signature}` } });
  };
  const { results } = await json<{ results: FirefoxVersion[] }>(
    amo(`${versions}?filter=all_without_unlisted`),
  );
  const existing = results.find((entry) => entry.version === version);
  if (existing) {
    if (existing.is_disabled || !['unreviewed', 'public'].includes(existing.file.status))
      throw new Error(`Firefox ${version} already exists. Check its status on AMO.`);
    if (!existing.source) throw new Error(`Firefox ${version} is missing its source ZIP on AMO.`);
    console.log(`Firefox ${version} already exists (${existing.file.status}).`);
    return;
  }
  if (results.some((entry) => entry.file.status === 'unreviewed'))
    throw new Error('Another Firefox submission is awaiting review.');
  if (!results.some((entry) => entry.file.status === 'public'))
    throw new Error('Publish the first Firefox version on AMO.');

  const form = new FormData();
  form.set('channel', 'listed');
  form.set('upload', new Blob([readFileSync(`${prefix}-firefox.zip`)]), 'ytenrich-firefox.zip');
  const { uuid } = await json<FirefoxUpload>(
    amo(`${base}/upload/`, { method: 'POST', body: form }),
  );
  if (typeof uuid !== 'string' || !/^[0-9a-f-]+$/i.test(uuid))
    throw new Error('AMO returned no upload ID.');
  await waitFor(`Firefox validation ${uuid}`, async () => {
    const result = await json<FirefoxUpload>(amo(`${base}/upload/${uuid}/`));
    if (!result.processed) return false;
    if (!result.valid || result.version !== version)
      throw new Error(`AMO did not validate ${version}. Upload ID: ${uuid}`);
    return true;
  });

  const submission = new FormData();
  submission.set('upload', uuid);
  submission.set('source', new Blob([readFileSync(`${prefix}-source.zip`)]), 'ytenrich-source.zip');
  submission.set(
    'approval_notes',
    `${notes} Build instructions are in README.md in the source ZIP.`,
  );
  const created = await json<FirefoxVersion>(amo(versions, { method: 'POST', body: submission }));
  if (created.version !== version || !created.source)
    throw new Error('AMO did not confirm the submitted version and source. Check the dashboard.');
  console.log(`Firefox ${version} submitted with source.`);
}

const [store, version] = process.argv.slice(2);
if (!version || !/^(0|[1-9]\d*)(\.(0|[1-9]\d*)){2}$/.test(version))
  throw new Error('Expected a numeric major.minor.patch release version.');
const prefix = `release/ytenrich-${version}`;
if (store === 'firefox') await firefox(version, prefix);
else if (store === 'chrome' || store === 'edge')
  await (store === 'chrome' ? chrome : edge)(version, readFileSync(`${prefix}-chromium.zip`));
else throw new Error('Expected chrome, edge or firefox.');
