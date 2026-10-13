// -----------------------------------------------------------------------------
// The only place that talks to the network: `fetch` with a timeout and an
// identifiable User-Agent. The tests replace it with `setFetch()`.
// -----------------------------------------------------------------------------

import { HTTP_TIMEOUT, USER_AGENT } from './constants.js';

let fetchImpl = (...args) => globalThis.fetch(...args);

/** Replace the fetch implementation (tests only). Returns the previous one. */
export function setFetch(impl) {
  const previous = fetchImpl;
  fetchImpl = impl;
  return previous;
}

export class HttpError extends Error {
  constructor(status, url) {
    super(`HTTP ${status} (${new URL(url).pathname})`);
    this.name = 'HttpError';
    this.status = status;
  }
}

/**
 * GET a JSON document. Resolves `undefined` on 204 (Nord Pool's "not
 * published yet"), throws an HttpError on any other non-2xx status.
 */
export async function getJson(url, { timeout = HTTP_TIMEOUT, signal } = {}) {
  const timeoutSignal = AbortSignal.timeout(Math.max(1, timeout));
  const response = await fetchImpl(url, {
    headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
    signal: signal ? AbortSignal.any([signal, timeoutSignal]) : timeoutSignal,
  });
  if (response.status === 204) {
    return undefined;
  }
  if (!response.ok) {
    throw new HttpError(response.status, url);
  }
  const text = await response.text();
  return text ? JSON.parse(text) : undefined;
}
