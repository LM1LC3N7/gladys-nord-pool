import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULTS, normalizeConfig } from '../src/config.js';

test('the configuration is normalized and defaulted', () => {
  assert.deepEqual(normalizeConfig(), { areas: ['FR'], currency: 'EUR', cheapHours: 4 });
  assert.deepEqual(
    normalizeConfig({ areas: ['se3', ' NO1 ', 'XX', 'SE3'], currency: 'sek', cheap_hours: '6' }),
    {
      areas: ['SE3', 'NO1'], // the order of AREAS
      currency: 'SEK',
      cheapHours: 6,
    },
  );
  assert.deepEqual(normalizeConfig({ areas: 'FR,BE', currency: 'USD', cheap_hours: 40 }), {
    areas: ['FR', 'BE'],
    currency: DEFAULTS.currency,
    cheapHours: DEFAULTS.cheap_hours,
  });
});

test('#6: the areas follow the order of AREAS, not the order of the form', () => {
  // The widget without a chosen area shows the first one: it must be stable.
  const expected = ['FR', 'FI', 'SE3', 'PL'];
  for (const areas of [['PL', 'SE3', 'FI', 'FR'], ['FI', 'FR', 'PL', 'SE3'], 'se3,pl,fr,fi']) {
    assert.deepEqual(normalizeConfig({ areas }).areas, expected, String(areas));
  }
});
