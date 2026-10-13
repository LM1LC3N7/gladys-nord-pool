import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULTS, normalizeConfig } from '../src/config.js';

test('the configuration is normalized and defaulted', () => {
  assert.deepEqual(normalizeConfig(), { areas: ['FR'], currency: 'EUR', cheapHours: 4 });
  assert.deepEqual(
    normalizeConfig({ areas: ['se3', ' NO1 ', 'XX', 'SE3'], currency: 'sek', cheap_hours: '6' }),
    {
      areas: ['SE3', 'NO1'],
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
