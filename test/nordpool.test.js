import { afterEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { dayUrl, fetchDay } from '../src/nordpool.js';
import { fixture, installFetch, json, noContent } from './helpers/fakeFetch.js';

let fake;
afterEach(() => fake?.restore());

test('dayUrl asks the portal for one CET day, areas and currency', () => {
  assert.equal(
    dayUrl({ date: '2026-10-13', areas: ['FR', 'SE3'], currency: 'SEK' }),
    'https://dataportal-api.nordpoolgroup.com/api/DayAheadPrices?date=2026-10-13&market=DayAhead&deliveryArea=FR%2CSE3&currency=SEK',
  );
});

test('fetchDay parses an answer, resolves null on 204, throws on an error', async () => {
  fake = installFetch([
    [/date=2026-10-13/, () => json(fixture('dayahead-2026-10-13-sek.json'))],
    [/date=2026-10-14/, () => noContent()],
    [/date=2025-01-01/, () => new Response('', { status: 401 })],
  ]);
  const day = await fetchDay({ date: '2026-10-13', areas: ['SE3'], currency: 'SEK' });
  assert.equal(day.currency, 'SEK');
  assert.equal(day.areas.SE3[0].price, 1.42862);
  assert.equal(fake.calls[0].init.headers['User-Agent'].startsWith('gladys-nord-pool'), true);
  assert.equal(await fetchDay({ date: '2026-10-14', areas: ['SE3'], currency: 'SEK' }), null);
  await assert.rejects(fetchDay({ date: '2025-01-01', areas: ['SE3'], currency: 'SEK' }), {
    status: 401,
  });
});
