import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateWidgetContent } from '@gladysassistant/integration-sdk';
import { parseDay } from '../src/nordpool.js';
import { AreaPrices, addDays } from '../src/prices.js';
import { buildWidget } from '../src/widget.js';
import { FIXTURE_DATE, FIXTURE_NOW, fixture } from './helpers/fakeFetch.js';

const day = parseDay(fixture('dayahead-2026-10-13-eur.json'));

function pricesOf(area, { tomorrow = false } = {}) {
  const prices = new AreaPrices(area, 'EUR');
  prices.setDay(FIXTURE_DATE, { slots: day.areas[area], final: true });
  if (tomorrow) {
    prices.setDay(addDays(FIXTURE_DATE, 1), {
      slots: day.areas[area].map((s) => ({
        start: s.start + 86400_000,
        end: s.end + 86400_000,
        price: s.price * 0.8,
      })),
      final: false,
    });
  }
  return prices;
}

const build = (prices, extra = {}) =>
  buildWidget({
    area: 'FR',
    timezone: 'Europe/Paris',
    currency: 'EUR',
    prices,
    at: prices.at(FIXTURE_NOW, { cheapHours: 4 }),
    now: FIXTURE_NOW,
    cheapHours: 4,
    language: 'fr',
    ...extra,
  });

test('the widget fits the core vocabulary, with and without tomorrow', () => {
  for (const tomorrow of [false, true]) {
    const content = build(pricesOf('FR', { tomorrow }));
    assert.deepEqual(validateWidgetContent(content), [], `tomorrow=${tomorrow}`);
    const chart = content.components.find((c) => c.type === 'chart');
    assert.equal(chart.chart_type, 'stepline');
    assert.equal(chart.series[0].points.length, tomorrow ? 193 : 97);
    assert.equal(chart.now_marker, true);
    const tiles = content.components.filter((c) => c.type === 'value');
    assert.equal(tiles.length, tomorrow ? 4 : 3);
    assert.equal(tiles[0].unit, '€/kWh');
    const status = content.components.find((c) => c.type === 'status');
    assert.equal(status.items.length, 3);
    assert.match(status.items[1].value, /^\d\d:\d\d – \d\d:\d\d$/);
    assert.equal(status.items[2].value.fr, tomorrow ? 'Publiés' : 'Pas encore (vers 13 h CET)');
  }
});

test('without any price the widget explains itself', () => {
  const content = build(new AreaPrices('FR', 'EUR'), { at: undefined });
  assert.deepEqual(validateWidgetContent(content), []);
  assert.equal(content.components.length, 2);
  assert.match(content.components[1].text.en, /No price yet/);
});

test('a currency without a symbol keeps its code', () => {
  const content = build(pricesOf('FR'), { currency: 'SEK' });
  assert.equal(content.components.find((c) => c.type === 'value').unit, 'kr/kWh');
  assert.deepEqual(validateWidgetContent(content), []);
});
