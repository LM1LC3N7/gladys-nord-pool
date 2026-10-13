import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseDay } from '../src/nordpool.js';
import {
  AreaPrices,
  addDays,
  cheapSlots,
  cheapestWindow,
  levelOf,
  localClock,
  marketDate,
  slotAfter,
  slotAt,
  slotStart,
  stats,
} from '../src/prices.js';
import { FIXTURE_DATE, FIXTURE_NOW, fixture } from './helpers/fakeFetch.js';

const day = parseDay(fixture('dayahead-2026-10-13-eur.json'));

test('parseDay turns the portal answer into per-kWh slots per area', () => {
  assert.equal(day.date, FIXTURE_DATE);
  assert.equal(day.currency, 'EUR');
  assert.equal(day.final, true);
  assert.deepEqual(Object.keys(day.areas), ['FR', 'NL', 'SE3']);
  assert.equal(day.areas.FR.length, 96);
  const first = day.areas.FR[0];
  assert.equal(first.start, Date.parse('2026-10-12T22:00:00Z'));
  assert.equal(first.end, Date.parse('2026-10-12T22:15:00Z'));
  assert.equal(first.price, 0.19812);
  assert.equal(parseDay({ multiAreaEntries: [] }), null);
  assert.equal(
    parseDay({ multiAreaEntries: [{ deliveryStart: 'x', entryPerArea: { FR: 1 } }] }),
    null,
  );
});

test('market dates follow the CET clock', () => {
  assert.equal(marketDate(Date.parse('2026-10-12T22:00:00Z')), '2026-10-13');
  assert.equal(marketDate(Date.parse('2026-10-12T21:59:00Z')), '2026-10-12');
  assert.equal(marketDate(Date.parse('2026-01-05T23:30:00Z')), '2026-01-06');
  assert.deepEqual(localClock(Date.parse('2026-10-13T10:45:00Z'), 'Europe/Helsinki'), {
    date: '2026-10-13',
    hour: 13,
    minute: 45,
  });
  assert.equal(addDays('2026-10-31', 1), '2026-11-01');
  assert.equal(addDays('2026-01-01', -1), '2025-12-31');
  assert.equal(slotStart(Date.parse('2026-10-13T08:07:00Z')), Date.parse('2026-10-13T08:00:00Z'));
});

test('slots, statistics and levels of a day', () => {
  const slots = day.areas.FR;
  const now = slotAt(slots, FIXTURE_NOW);
  assert.equal(now.start, FIXTURE_NOW);
  assert.equal(slotAfter(slots, FIXTURE_NOW).start, FIXTURE_NOW + 15 * 60_000);
  assert.equal(slotAt(slots, Date.parse('2026-10-13T22:00:00Z')), undefined);
  const s = stats(slots);
  assert.ok(s.min.price < s.avg && s.avg < s.max.price);
  // Nord Pool's own daily average of FR: 169.44 EUR/MWh.
  assert.equal(Math.round(s.avg * 100000) / 100, 169.44);
  assert.equal(levelOf(0.05, 0.1), 'very_cheap');
  assert.equal(levelOf(0.08, 0.1), 'cheap');
  assert.equal(levelOf(0.1, 0.1), 'normal');
  assert.equal(levelOf(0.12, 0.1), 'expensive');
  assert.equal(levelOf(0.2, 0.1), 'very_expensive');
  assert.equal(levelOf(-0.01, 0), 'very_cheap');
  assert.equal(levelOf(0.05, -0.01), 'very_expensive');
});

test('the cheapest hours: a set of slots, and a contiguous window', () => {
  const slots = day.areas.SE3;
  const cheap = cheapSlots(slots, 2);
  assert.equal(cheap.size, 8);
  const prices = [...cheap].map((start) => slotAt(slots, start).price);
  const rest = slots.filter((s) => !cheap.has(s.start)).map((s) => s.price);
  assert.ok(Math.max(...prices) <= Math.min(...rest));
  const window = cheapestWindow(slots, 3);
  assert.equal(window.end - window.start, 3 * 3600_000);
  // SE3 is nearly free in the evening of that day.
  assert.ok(window.start >= Date.parse('2026-10-13T17:00:00Z'));
  assert.equal(cheapestWindow(slots, 25), undefined);
  // A gap in the day: the window never straddles it.
  const gappy = slots.filter((s) => s.start !== Date.parse('2026-10-13T19:00:00Z'));
  const w2 = cheapestWindow(gappy, 3);
  assert.ok(
    w2.start >= Date.parse('2026-10-13T19:15:00Z') || w2.end <= Date.parse('2026-10-13T19:00:00Z'),
  );
});

test('AreaPrices merges the days and describes an instant', () => {
  const prices = new AreaPrices('FR', 'EUR');
  assert.equal(prices.at(FIXTURE_NOW), undefined);
  prices.setDay(FIXTURE_DATE, { slots: day.areas.FR, final: true });
  const tomorrow = day.areas.FR.map((s) => ({
    start: s.start + 86400_000,
    end: s.end + 86400_000,
    price: s.price / 2,
  }));
  prices.setDay(addDays(FIXTURE_DATE, 1), { slots: tomorrow, final: false });
  assert.equal(prices.slots.length, 192);
  const now = prices.at(FIXTURE_NOW, { cheapHours: 4 });
  assert.equal(now.date, FIXTURE_DATE);
  assert.equal(now.slot.price, slotAt(day.areas.FR, FIXTURE_NOW).price);
  assert.equal(typeof now.level, 'string');
  assert.equal(now.window.end - now.window.start, 4 * 3600_000);
  // The last slot of today looks at tomorrow for its next price.
  const lastSlot = Date.parse('2026-10-13T21:45:00Z');
  assert.equal(prices.at(lastSlot).next.start, Date.parse('2026-10-13T22:00:00Z'));
  prices.prune(addDays(FIXTURE_DATE, 1));
  assert.equal(prices.has(FIXTURE_DATE), false);
  assert.equal(prices.slots.length, 96);
});
