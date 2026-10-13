// -----------------------------------------------------------------------------
// Fake `fetch` for the tests: routes requests to handlers, records every
// call, and fails loudly on an unexpected URL. No test touches the network.
// -----------------------------------------------------------------------------

import { readFileSync } from 'node:fs';
import { setFetch } from '../../src/http.js';

setFetch(async (url) => {
  throw new Error(`Network call without a fake fetch in a test: ${url}`);
});

export function fixture(name) {
  return JSON.parse(readFileSync(new URL(`../fixtures/${name}`, import.meta.url), 'utf8'));
}

export const json = (body, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });

export const noContent = () => new Response(null, { status: 204 });

/**
 * Install a fake fetch. `routes` is a list of [pattern, handler]: the first
 * route whose RegExp matches the URL answers handler(call), `call` being
 * `{ url, params }` with the query parsed.
 */
export function installFetch(routes) {
  const calls = [];
  const previous = setFetch(async (url, init = {}) => {
    const call = { url, params: Object.fromEntries(new URL(url).searchParams), init };
    calls.push(call);
    const route = routes.find(([pattern]) => pattern.test(url));
    if (!route) {
      throw new Error(`Unexpected network call in a test: ${url}`);
    }
    return route[1](call);
  });
  return { calls, restore: () => setFetch(previous) };
}

// The recorded day: 2026-10-13 (CET), FR / NL / SE3 in EUR, 96 slots.
export const FIXTURE_DATE = '2026-10-13';
// A quiet instant of that day: 10:00 CEST.
export const FIXTURE_NOW = Date.parse('2026-10-13T08:00:00Z');
