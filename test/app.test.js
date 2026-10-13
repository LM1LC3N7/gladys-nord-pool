// -----------------------------------------------------------------------------
// The integration against the SDK's fake Gladys and a fake Nord Pool.
// -----------------------------------------------------------------------------

import { afterEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createFakeGladys } from '@gladysassistant/integration-sdk/testing';
import { ACTION_TEST, NordPoolApp, WIDGET_KEY } from '../src/app.js';
import { SCENE_TRIGGERS } from '../src/triggers.js';
import {
  FIXTURE_DATE,
  FIXTURE_NOW,
  fixture,
  installFetch,
  json,
  noContent,
} from './helpers/fakeFetch.js';
import { createFakeTimers } from './helpers/fakeTimers.js';

const quiet = {
  info() {},
  warn: (...a) => process.env.DEBUG_TEST && console.error(...a),
  error() {},
  debug() {},
};

let fake;
afterEach(() => fake?.restore());

/** The EUR fixture moved to another date (same prices). */
function dayAt(date, { factor = 1, source = 'dayahead-2026-10-13-eur.json' } = {}) {
  const answer = fixture(source);
  const shift = (Date.parse(`${date}T00:00:00Z`) - Date.parse('2026-10-13T00:00:00Z')) / 86400_000;
  const move = (iso) => new Date(Date.parse(iso) + shift * 86400_000).toISOString();
  return {
    ...answer,
    deliveryDateCET: date,
    multiAreaEntries: answer.multiAreaEntries.map((e) => ({
      deliveryStart: move(e.deliveryStart),
      deliveryEnd: move(e.deliveryEnd),
      entryPerArea: Object.fromEntries(
        Object.entries(e.entryPerArea).map(([k, v]) => [k, v * factor]),
      ),
    })),
  };
}

const TOMORROW = '2026-10-14';
const AFTERNOON = Date.parse('2026-10-13T12:00:00Z'); // 14:00 CEST, tomorrow is due

function setup({ config = { areas: ['FR'] }, now = FIXTURE_NOW, routes, calendars = {} } = {}) {
  fake = installFetch(
    routes ?? [
      [/date=2026-10-13&.*currency=EUR/, () => json(dayAt(FIXTURE_DATE))],
      [/date=2026-10-14/, () => noContent()],
    ],
  );
  const gladys = createFakeGladys({ selector: 'nord-pool', config, energyCalendars: calendars });
  const timers = createFakeTimers();
  const clock = { now };
  const dataDir = mkdtempSync(join(tmpdir(), 'nord-pool-'));
  const app = new NordPoolApp({
    gladys,
    logger: quiet,
    now: () => clock.now,
    timers,
    dataDir,
    sleep: async () => {},
  });
  // What index.js wires.
  gladys.onWidgetGet(WIDGET_KEY, (request) => app.getWidget(request));
  gladys.onAction(ACTION_TEST, () => app.testConnection());
  return { app, gladys, timers, clock, dataDir };
}

const FR = 'ext:nord-pool:area:FR';

test('start publishes one device per area, its states, and the status', async () => {
  const { app, gladys, timers } = setup();
  await app.start({ areas: ['FR'] });
  const [device] = gladys.fake.discoveredDevices;
  assert.equal(device.external_id, FR);
  assert.equal(device.name, 'Nord Pool FR');
  assert.deepEqual(
    device.features.map((f) => [f.external_id.split(':').at(-1), f.unit]),
    [
      ['current', 'euro'],
      ['next', 'euro'],
      ['avg', 'euro'],
      ['min', 'euro'],
      ['max', 'euro'],
    ],
  );
  assert.equal(gladys.fake.lastState(`${FR}:current`), 0.2009);
  assert.equal(gladys.fake.lastState(`${FR}:avg`), 0.16944);
  assert.equal(gladys.fake.connectionStatus.connected, true);
  assert.match(gladys.fake.connectionStatus.message.fr, /aujourd'hui\.$/);
  // Before 12:45 CET, tomorrow is not even asked.
  assert.equal(fake.calls.length, 1);
  assert.equal(timers.intervals().length, 1, 'the hourly refresh');
  assert.equal(timers.timeouts().length, 1, 'the next 15-minute tick');
  assert.equal(gladys.fake.widgetRefreshes.length, 1);
  await app.stop();
  assert.equal(timers.pending.size, 0);
});

test('tomorrow: asked from 12:45, retried every 10 minutes, announced once', async () => {
  let published = false;
  const { app, gladys, timers } = setup({
    now: AFTERNOON,
    routes: [
      [/date=2026-10-13&/, () => json(dayAt(FIXTURE_DATE))],
      [
        /date=2026-10-14&/,
        () => (published ? json(dayAt(TOMORROW, { factor: 0.5 })) : noContent()),
      ],
    ],
  });
  await app.start({ areas: ['FR'] });
  assert.equal(fake.calls.length, 2);
  assert.match(gladys.fake.connectionStatus.message.en, /for today\.$/);
  const retry = timers.timeouts().find((t) => t.ms === 10 * 60_000);
  assert.ok(retry, 'a retry in 10 minutes');
  published = true;
  await retry.fn();
  assert.match(gladys.fake.connectionStatus.message.en, /today and tomorrow\.$/);
  const events = gladys.fake.sceneEvents.filter((e) => e.key === SCENE_TRIGGERS.tomorrow);
  assert.equal(events.length, 1);
  assert.equal(events[0].data.device, FR);
  assert.equal(events[0].data.currency, 'EUR');
  assert.ok(events[0].data.cheapest_start < events[0].data.cheapest_end);
  assert.equal(Math.round(events[0].data.average * 100000), Math.round(0.16944 * 50000));
  // The hourly refresh reads it again without announcing it again.
  await timers.runIntervals();
  assert.equal(gladys.fake.sceneEvents.filter((e) => e.key === SCENE_TRIGGERS.tomorrow).length, 1);
  assert.ok(!timers.timeouts().some((t) => t.ms === 10 * 60_000), 'no retry once published');
  await app.stop();
});

test('the 15-minute tick fires the cheap period and level transitions', async () => {
  const { app, gladys, timers, clock } = setup({ now: Date.parse('2026-10-13T05:45:00Z') });
  await app.start({ areas: ['FR'], cheap_hours: 2 });
  const before = gladys.fake.sceneEvents.length;
  assert.equal(before, 0, 'a restart is not a transition');
  // Walk the whole day slot by slot and collect the transitions.
  const seen = [];
  for (let i = 0; i < 70; i += 1) {
    clock.now += 15 * 60_000;
    const [tick] = timers.timeouts();
    await tick.fn();
    for (const e of gladys.fake.sceneEvents.slice(seen.length)) {
      seen.push(e);
    }
  }
  const keys = seen.map((e) => e.key);
  assert.ok(keys.includes(SCENE_TRIGGERS.cheapStarted));
  assert.ok(keys.includes(SCENE_TRIGGERS.cheapEnded));
  assert.ok(keys.includes(SCENE_TRIGGERS.levelChanged));
  const started = seen.filter((e) => e.key === SCENE_TRIGGERS.cheapStarted);
  const ended = seen.filter((e) => e.key === SCENE_TRIGGERS.cheapEnded);
  assert.ok(started.length >= 1 && ended.length >= started.length - 1);
  assert.equal(started[0].data.device, FR);
  assert.equal(typeof started[0].data.price, 'number');
  const level = seen.find((e) => e.key === SCENE_TRIGGERS.levelChanged);
  assert.ok(level.data.level !== level.data.previous_level);
  // The sensor followed.
  assert.equal(typeof gladys.fake.lastState(`${FR}:current`), 'number');
  await app.stop();
});

test('energy calendars: fed in the currency of the area, backfilled once', async () => {
  const requested = [];
  const { app, gladys, dataDir, timers } = setup({
    config: { areas: ['FR', 'SE3'], currency: 'EUR' },
    calendars: { 'spot-fr': [], 'spot-se3': [] },
    routes: [
      [
        /DayAheadPrices/,
        ({ params }) => {
          requested.push(`${params.date} ${params.currency} ${params.deliveryArea}`);
          if (params.date < '2026-09-01') {
            return new Response('', { status: 401 });
          }
          if (params.date > FIXTURE_DATE) {
            return noContent();
          }
          return json(
            dayAt(params.date, {
              source: params.currency === 'SEK' ? 'dayahead-2026-10-13-sek.json' : undefined,
            }),
          );
        },
      ],
    ],
  });
  await app.start({ areas: ['FR', 'SE3'], currency: 'EUR' });
  // Today: EUR for the sensors of both areas, SEK for the SE3 calendar.
  assert.deepEqual(requested.slice(0, 2), ['2026-10-13 EUR FR,SE3', '2026-10-13 SEK SE3']);
  const published = gladys.fake.publishedEnergyCalendars;
  const fr = published.find((p) => p.calendar_key === 'spot-fr');
  const se3 = published.find((p) => p.calendar_key === 'spot-se3');
  assert.equal(fr.entries.length, 96);
  assert.equal(fr.entries[0].currency, 'EUR');
  assert.equal(fr.entries[0].price, 0.19812);
  assert.equal(se3.entries[0].currency, 'SEK');
  assert.equal(se3.entries[0].price, 1.42862);
  // The sensor of SE3 is in EUR, the user's currency.
  assert.equal(gladys.fake.lastState('ext:nord-pool:area:SE3:current'), 0.18965);
  // The backfill ran in the background: 42 days back, 401 past the portal's memory.
  await app.backfilling;
  const history = requested.filter((r) => r < '2026-10-13');
  assert.ok(history.length >= 42 * 2, `${history.length} history requests`);
  assert.ok(history[0].startsWith('2026-09-01'));
  const state = JSON.parse(readFileSync(join(dataDir, 'calendars.json'), 'utf8'));
  assert.ok(state['spot-fr'].backfilled_at && state['spot-se3'].backfilled_at);
  const frEntries = gladys.fake.energyCalendars['spot-fr'];
  assert.ok(frEntries.length > 96 * 30, `${frEntries.length} entries in the FR calendar`);
  // A second start does not backfill again.
  const count = requested.length;
  await app.start({ areas: ['FR', 'SE3'], currency: 'EUR' });
  await timers.runTimeouts();
  assert.ok(requested.length - count <= 3);
  await app.stop();
});

test('an unreachable portal: disconnected without prices, stale with them, retried', async () => {
  let down = true;
  const { app, gladys, timers } = setup({
    routes: [
      [
        /DayAheadPrices/,
        ({ params }) => {
          if (down) {
            throw new TypeError('fetch failed');
          }
          return params.date === FIXTURE_DATE ? json(dayAt(FIXTURE_DATE)) : noContent();
        },
      ],
    ],
  });
  await app.start({ areas: ['FR'] });
  assert.equal(gladys.fake.connectionStatus.connected, false);
  assert.match(gladys.fake.connectionStatus.message.en, /unreachable: fetch failed/);
  const retry = timers.timeouts().find((t) => t.ms === 5 * 60_000);
  assert.ok(retry, 'a retry in 5 minutes');
  down = false;
  await retry.fn();
  assert.equal(gladys.fake.connectionStatus.connected, true);
  assert.match(gladys.fake.connectionStatus.message.en, /^Prices of FR/);
  down = true;
  await timers.runIntervals();
  assert.equal(gladys.fake.connectionStatus.connected, true, 'the last prices stay');
  assert.match(gladys.fake.connectionStatus.message.en, /last prices read for FR/);
  await app.stop();
});

test('an area Nord Pool does not price is reported', async () => {
  const { app, gladys } = setup({
    config: { areas: ['NO4'] },
    routes: [[/DayAheadPrices/, () => noContent()]],
  });
  await app.start({ areas: ['NO4'] });
  assert.equal(gladys.fake.connectionStatus.connected, false);
  assert.match(gladys.fake.connectionStatus.message.fr, /aucun prix pour NO4/);
  await app.stop();
});

test('the widget and the action read the configured area', async () => {
  const { app, gladys } = setup();
  await app.start({ areas: ['FR'] });
  const ack = await gladys.fake.widgetGet('prices', {
    settings: { area: FR },
    language: 'fr',
    units: 'metric',
  });
  assert.equal(ack.success, true);
  const content = ack.data.content;
  assert.equal(content.components[0].text, 'Nord Pool FR');
  assert.equal(content.components.find((c) => c.type === 'value').value, 0.201);
  const unknown = await gladys.fake.widgetGet('prices', {
    settings: { area: 'ext:nord-pool:area:XX' },
    language: 'en',
    units: 'metric',
  });
  assert.equal(
    unknown.data.content.components[0].text,
    'Nord Pool FR',
    'falls back to the first area',
  );
  const report = await gladys.fake.action('test_connection', {});
  assert.match(
    report.data.message.en,
    /^Nord Pool OK\. FR: 0\.2009 EUR\/kWh now \(expensive\), 0\.1694 on average today; tomorrow's prices are not published yet\.$/,
  );
  await app.stop();
});

test('a configuration change restarts with the new areas', async () => {
  const { app, gladys } = setup({
    routes: [
      [
        /DayAheadPrices/,
        ({ params }) => (params.date === FIXTURE_DATE ? json(dayAt(FIXTURE_DATE)) : noContent()),
      ],
    ],
  });
  await app.start({ areas: ['FR'] });
  await app.start({ areas: ['NL', 'FR'], currency: 'EUR', cheap_hours: 3 });
  assert.deepEqual(
    gladys.fake.discoveredDevices.map((d) => d.external_id),
    ['ext:nord-pool:area:NL', FR],
  );
  assert.equal(gladys.fake.lastState('ext:nord-pool:area:NL:current'), 0.19995);
  await app.stop();
});
