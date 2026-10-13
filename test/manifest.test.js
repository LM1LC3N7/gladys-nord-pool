// -----------------------------------------------------------------------------
// The manifest is the contract with Gladys and the store: these tests tie it
// to the code, so a key renamed on one side only fails here.
// -----------------------------------------------------------------------------

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { ACTION_TEST, WIDGET_KEY } from '../src/app.js';
import { DEFAULTS } from '../src/config.js';
import { AREAS, CURRENCIES } from '../src/constants.js';
import { SCENE_TRIGGERS } from '../src/triggers.js';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const manifest = JSON.parse(read('gladys-assistant-integration.json'));
const index = read('index.js');

function* texts(node, path = '') {
  if (Array.isArray(node)) {
    for (const [i, item] of node.entries()) {
      yield* texts(item, `${path}[${i}]`);
    }
  } else if (node && typeof node === 'object') {
    if ('en' in node || 'fr' in node) {
      yield [path, node];
      return;
    }
    for (const [key, value] of Object.entries(node)) {
      yield* texts(value, `${path}.${key}`);
    }
  }
}

test('the store basics', () => {
  assert.equal(manifest.manifest_version, 1);
  assert.equal(manifest.type, 'device');
  assert.match(manifest.gladys_version, />=5\.2\.0/, 'energy contracts need Gladys 5.2');
  assert.equal(manifest.docker_image, `ghcr.io/lm1lc3n7/gladys-nord-pool:${manifest.version}`);
  assert.equal(manifest.version, JSON.parse(read('package.json')).version);
  for (const lang of ['en', 'fr']) {
    const length = manifest.description[lang].length;
    assert.ok(length >= 10 && length <= 100, `description.${lang}: ${length} characters`);
  }
  assert.match(manifest.description.en, /Unofficial/);
  assert.match(manifest.description.fr, /non officiel/);
});

test('every text is bilingual', () => {
  for (const [path, text] of texts(manifest)) {
    assert.ok(text.en?.trim() && text.fr?.trim(), `${path} needs en and fr`);
  }
});

test('the configuration matches the code', () => {
  const fields = Object.fromEntries(manifest.config_schema.map((f) => [f.key, f]));
  assert.deepEqual(fields.areas.default, DEFAULTS.areas);
  assert.deepEqual(
    fields.areas.options.map((o) => o.value),
    Object.keys(AREAS),
  );
  assert.equal(fields.currency.default, DEFAULTS.currency);
  assert.deepEqual(
    fields.currency.options.map((o) => o.value),
    CURRENCIES,
  );
  assert.equal(fields.cheap_hours.default, DEFAULTS.cheap_hours);
});

test('the triggers, the widget and the action are wired', () => {
  assert.deepEqual(
    manifest.scene_triggers.map((t) => t.key).sort(),
    Object.values(SCENE_TRIGGERS).sort(),
  );
  for (const trigger of manifest.scene_triggers) {
    assert.equal(trigger.fields[0].key, 'device');
    assert.equal(trigger.fields[0].source, 'devices');
  }
  assert.deepEqual(
    manifest.widgets.map((w) => w.key),
    [WIDGET_KEY],
  );
  assert.ok(index.includes(`onWidgetGet(WIDGET_KEY`));
  assert.deepEqual(
    manifest.actions.map((a) => a.key),
    [ACTION_TEST],
  );
  assert.ok(index.includes(`onAction(ACTION_TEST`));
});

test('the energy calendars and templates follow the areas table', () => {
  const { calendars, templates } = manifest.energy_contracts;
  const withCalendar = Object.entries(AREAS).filter(([, a]) => a.calendar);
  assert.equal(calendars.length, withCalendar.length);
  assert.ok(calendars.length <= 10, 'the store allows ten calendars');
  for (const [area, info] of withCalendar) {
    const calendar = calendars.find((c) => c.key === info.calendar);
    assert.ok(calendar, `calendar of ${area}`);
    assert.equal(calendar.granularity, 'fifteen_minutes');
    assert.equal(calendar.currency, info.currency);
    assert.equal(calendar.timezone, info.timezone);
    const template = templates.find((t) => t.key === `nord-pool-spot-${area.toLowerCase()}`);
    assert.ok(template, `template of ${area}`);
    assert.equal(template.country, info.country);
    assert.equal(template.currency, info.currency);
    assert.equal(template.timezone, info.timezone);
    assert.equal(template.pricing_mode, 'rules');
    assert.deepEqual(template.calendars, [info.calendar]);
    assert.equal(template.inputs.find((i) => i.key === 'vat').default, info.vat);
    const energy = template.tariff.components.find((c) => c.key === 'energy');
    assert.equal(energy.rules[0].price_from_calendar, info.calendar);
  }
});

test('the docs exist in both languages, long enough for the store', () => {
  for (const lang of ['en', 'fr']) {
    assert.ok(read(`docs/${lang}.md`).length >= 300, `docs/${lang}.md`);
  }
});
