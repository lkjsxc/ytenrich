import { createHmac, randomUUID } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';

export async function request(url: string, init?: RequestInit): Promise<Response> {
  const response = await fetch(url, {
    ...init,
    redirect: 'error',
    signal: AbortSignal.timeout(45_000),
  });
  if (!response.ok)
    throw new Error(`${init?.method ?? 'GET'} ${url} returned HTTP ${response.status}`);
  return response;
}

export async function json<T>(response: Promise<Response>): Promise<T> {
  return (await response).json();
}

// The stores expose asynchronous validation/operation status through GET requests.
export async function waitFor(label: string, check: () => Promise<boolean>): Promise<void> {
  const deadline = Date.now() + 180_000;
  do {
    if (await check()) return;
    await delay(5_000);
  } while (Date.now() < deadline);
  throw new Error(`${label} timed out. Check the store dashboard before retrying.`);
}

/** Requests to the AMO API, each signed with a fresh one-minute JWT from the API key and secret. AMO throttles
 * edits (HTTP 429): a throttled request waits and goes again with a new token, up to three times. */
export function amoClient(iss: string, secret: string) {
  const encode = (value: object) => Buffer.from(JSON.stringify(value)).toString('base64url');
  const amo = async (url: string, init?: RequestInit, attempt = 1): Promise<Response> => {
    const iat = Math.floor(Date.now() / 1000);
    const claims = encode({ iss, jti: randomUUID(), iat, exp: iat + 60 });
    const data = `${encode({ alg: 'HS256', typ: 'JWT' })}.${claims}`;
    const signature = createHmac('sha256', secret).update(data).digest('base64url');
    const auth = { Authorization: `JWT ${data}.${signature}` };
    try {
      return await request(url, { ...init, headers: { ...(init?.headers as object), ...auth } });
    } catch (e) {
      if (attempt >= 4 || !String(e).includes('HTTP 429')) throw e;
      console.log(
        `AMO throttled ${init?.method ?? 'GET'} ${url}; trying again in ${30 * attempt}s.`,
      );
      await delay(30_000 * attempt);
      return amo(url, init, attempt + 1);
    }
  };
  return (url: string, init?: RequestInit): Promise<Response> => amo(url, init);
}
