import { test } from 'node:test';
import assert from 'node:assert/strict';
import { batches, calendarEntries } from '../src/calendars.js';

test('calendar entries are 15-minute slots priced per kWh', () => {
  const entries = calendarEntries(
    [
      {
        start: Date.parse('2026-10-12T22:00:00Z'),
        end: Date.parse('2026-10-12T22:15:00Z'),
        price: 0.198,
      },
      {
        start: Date.parse('2026-10-12T22:15:00Z'),
        end: Date.parse('2026-10-12T22:30:00Z'),
        price: -0.001,
      },
    ],
    'EUR',
  );
  assert.deepEqual(entries, [
    { starts_at: '2026-10-12T22:00:00.000Z', price: 0.198, currency: 'EUR' },
    { starts_at: '2026-10-12T22:15:00.000Z', price: -0.001, currency: 'EUR' },
  ]);
  const many = Array.from({ length: 4100 }, (_, i) => i);
  assert.deepEqual(
    batches(many).map((b) => b.length),
    [2000, 2000, 100],
  );
});
