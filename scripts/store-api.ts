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
