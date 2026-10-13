// -----------------------------------------------------------------------------
// The integration itself: reads the day-ahead prices of the configured areas,
// keeps the price sensors, the scene triggers, the widget and the energy
// calendars fed. index.js only wires the SDK handlers to it.
//
// Schedule: a read at start, then every hour (a preliminary price can be
// corrected); tomorrow is asked from 12:45 market time every 10 minutes
// until it is published; the sensors and triggers follow the 15-minute slots.
// -----------------------------------------------------------------------------

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createLogger } from '@gladysassistant/integration-sdk';
import { calendarEntries, batches } from './calendars.js';
import { normalizeConfig } from './config.js';
import {
  AREAS,
  BACKFILL_DAYS,
  MARKET_TIMEZONE,
  REFRESH_INTERVAL,
  REQUEST_SPACING,
  RETRY_INTERVAL,
  SLOT_MINUTES,
  TOMORROW_FROM,
  TOMORROW_RETRY,
} from './constants.js';
import { areaOf, buildDevice, buildStates, idsOf } from './devices.js';
import { T, connectionReport } from './i18n.js';
import { fetchDay } from './nordpool.js';
import { AreaPrices, addDays, localClock, marketDate, slotStart, stats } from './prices.js';
import { tomorrowEvent, transitions } from './triggers.js';
import { buildWidget } from './widget.js';

export const WIDGET_KEY = 'prices';
export const ACTION_TEST = 'test_connection';

const defaultTimers = { setTimeout, clearTimeout, setInterval, clearInterval };
const STATE_FILE = 'calendars.json';

export class NordPoolApp {
  constructor({
    gladys,
    logger = createLogger({ name: 'nord-pool' }),
    now = Date.now,
    timers = defaultTimers,
    dataDir = '/data',
    sleep,
  }) {
    this.gladys = gladys;
    this.logger = logger;
    this.now = now;
    this.timers = timers;
    this.dataDir = dataDir;
    this.sleep = sleep ?? ((ms) => new Promise((resolve) => this.timers.setTimeout(resolve, ms)));
    this.config = normalizeConfig();
    // area -> AreaPrices (in the user's currency)
    this.prices = new Map();
    // area -> the `at()` snapshot of the last tick, for the transitions
    this.last = new Map();
    // "area:date" of the days whose publication was announced
    this.announced = new Set();
    this.timerIds = [];
    this.tickTimer = undefined;
    this.retryTimer = undefined;
    this.tomorrowTimer = undefined;
    this.lastStatus = undefined;
    this.lastError = undefined;
    this.generation = 0;
    this.lifecycle = Promise.resolve();
    this.refreshing = undefined;
    this.backfilling = undefined;
  }

  // --- Lifecycle -------------------------------------------------------------

  start(raw = {}) {
    return this.serialize(() => this.doStart(raw));
  }

  stop() {
    return this.serialize(() => this.doStop());
  }

  serialize(job) {
    const run = this.lifecycle.then(job, job);
    this.lifecycle = run.catch(() => {});
    return run;
  }

  async doStart(raw) {
    await this.doStop();
    const generation = ++this.generation;
    this.config = normalizeConfig(raw);
    this.prices = new Map(
      this.config.areas.map((area) => [area, new AreaPrices(area, this.config.currency)]),
    );
    this.last = new Map();
    this.announced = new Set();
    this.lastError = undefined;
    await this.setStatus(false, T.starting);
    await this.publishDevices();
    await this.refresh();
    if (generation !== this.generation) {
      return;
    }
    this.timerIds.push(this.timers.setInterval(() => this.refresh(), REFRESH_INTERVAL));
    this.scheduleTick();
    // The history of the calendars, once, in the background.
    this.backfilling = this.backfill(generation).catch((err) =>
      this.logger.warn(`Calendar history failed: ${err.message}`),
    );
  }

  async doStop() {
    this.generation += 1;
    for (const id of this.timerIds) {
      this.timers.clearInterval(id);
    }
    this.timerIds = [];
    for (const key of ['tickTimer', 'retryTimer', 'tomorrowTimer']) {
      this.timers.clearTimeout(this[key]);
      this[key] = undefined;
    }
    await this.refreshing?.catch(() => {});
    await this.backfilling;
    this.backfilling = undefined;
  }

  async setStatus(connected, message) {
    const key = JSON.stringify([connected, message ?? null]);
    if (key === this.lastStatus) {
      return;
    }
    this.lastStatus = key;
    await this.gladys
      .setConnectionStatus(connected, message)
      .catch((err) => this.logger.warn(`setConnectionStatus failed: ${err.message}`));
  }

  // --- Devices ---------------------------------------------------------------

  async publishDevices() {
    const devices = this.config.areas.map((area) =>
      buildDevice(this.gladys, area, this.config.currency),
    );
    await this.gladys.publishDiscoveredDevices(devices);
  }

  // --- Reading Nord Pool -----------------------------------------------------

  /** True from 12:45 market time: tomorrow's prices may be out. */
  tomorrowDue(t = this.now()) {
    const { hour, minute } = localClock(t, MARKET_TIMEZONE);
    return (
      hour > TOMORROW_FROM.hour || (hour === TOMORROW_FROM.hour && minute >= TOMORROW_FROM.minute)
    );
  }

  /**
   * The requests of a day: one per currency, with its areas. The sensors
   * use the user's currency; a calendar uses the currency of its area.
   */
  requestGroups() {
    const groups = new Map();
    const add = (currency, area) => {
      if (!groups.has(currency)) {
        groups.set(currency, new Set());
      }
      groups.get(currency).add(area);
    };
    for (const area of this.config.areas) {
      add(this.config.currency, area);
      if (AREAS[area].calendar) {
        add(AREAS[area].currency, area);
      }
    }
    return groups;
  }

  /** Read today (and tomorrow when due), feed everything. Single-flight. */
  refresh() {
    if (!this.refreshing) {
      this.refreshing = this.doRefresh().finally(() => {
        this.refreshing = undefined;
      });
    }
    return this.refreshing;
  }

  async doRefresh() {
    const generation = this.generation;
    const now = this.now();
    const today = marketDate(now);
    const tomorrow = addDays(today, 1);
    const dates = this.tomorrowDue(now) ? [today, tomorrow] : [today];
    let tomorrowMissing = false;
    let failure;
    for (const [currency, areas] of this.requestGroups()) {
      for (const date of dates) {
        let day;
        try {
          day = await fetchDay({ date, areas: [...areas], currency });
        } catch (err) {
          failure = err;
          this.logger.warn(`Reading ${date} in ${currency} failed: ${err.message}`);
          continue;
        }
        if (generation !== this.generation) {
          return;
        }
        if (!day) {
          if (date === tomorrow) {
            tomorrowMissing = true;
          }
          continue;
        }
        for (const area of areas) {
          const slots = day.areas[area];
          if (!slots) {
            continue;
          }
          if (currency === this.config.currency) {
            this.prices.get(area).setDay(date, {
              slots,
              final: day.final,
              updatedAt: day.updatedAt,
            });
          }
          if (AREAS[area].calendar && AREAS[area].currency === currency) {
            await this.publishCalendar(area, slots);
          }
        }
      }
    }
    if (generation !== this.generation) {
      return;
    }
    for (const prices of this.prices.values()) {
      prices.prune(today);
    }
    this.lastError = failure;
    await this.tick({ reschedule: false });
    await this.announceTomorrow(tomorrow);
    this.gladys.requestWidgetRefresh?.(WIDGET_KEY);
    this.timers.clearTimeout(this.retryTimer);
    this.retryTimer = undefined;
    this.timers.clearTimeout(this.tomorrowTimer);
    this.tomorrowTimer = undefined;
    if (failure) {
      this.retryTimer = this.timers.setTimeout(() => this.refresh(), RETRY_INTERVAL);
    } else if (tomorrowMissing) {
      this.tomorrowTimer = this.timers.setTimeout(() => this.refresh(), TOMORROW_RETRY);
    }
  }

  /** Fire "tomorrow's prices published" once per area and day. */
  async announceTomorrow(date) {
    for (const [area, prices] of this.prices) {
      const key = `${area}:${date}`;
      const slots = prices.day(date);
      if (slots.length === 0 || this.announced.has(key)) {
        continue;
      }
      this.announced.add(key);
      const event = tomorrowEvent({
        device: idsOf(this.gladys, area).device,
        currency: this.config.currency,
        stats: stats(slots),
        window: prices.at(slots[0].start, { cheapHours: this.config.cheapHours })?.window,
      });
      await this.gladys
        .publishSceneEvent(event.key, event.data)
        .catch((err) => this.logger.warn(`Scene event ${event.key} failed: ${err.message}`));
    }
  }

  // --- The 15-minute tick ------------------------------------------------------

  scheduleTick() {
    this.timers.clearTimeout(this.tickTimer);
    const now = this.now();
    // A second after the slot boundary: the clocks of Gladys and ours agree.
    const next = slotStart(now) + SLOT_MINUTES * 60_000 + 1_000;
    this.tickTimer = this.timers.setTimeout(() => this.tick(), next - now);
  }

  /** Publish the states and the transitions of every area for now. */
  async tick({ reschedule = true } = {}) {
    const generation = this.generation;
    const now = this.now();
    const states = [];
    const events = [];
    const withPrices = [];
    for (const [area, prices] of this.prices) {
      const at = prices.at(now, { cheapHours: this.config.cheapHours });
      if (at) {
        withPrices.push(area);
      }
      states.push(...buildStates(this.gladys, area, at));
      events.push(
        ...transitions({
          device: idsOf(this.gladys, area).device,
          currency: this.config.currency,
          previous: this.last.get(area),
          current: at,
        }),
      );
      this.last.set(area, at);
    }
    if (states.length > 0) {
      await this.gladys
        .publishChangedStates(states, { heartbeat: 30 * 60_000 })
        .catch((err) => this.logger.warn(`Publishing the states failed: ${err.message}`));
    }
    for (const event of events) {
      await this.gladys
        .publishSceneEvent(event.key, event.data)
        .catch((err) => this.logger.warn(`Scene event ${event.key} failed: ${err.message}`));
    }
    if (generation !== this.generation) {
      return;
    }
    await this.updateStatus(withPrices);
    if (reschedule) {
      this.scheduleTick();
    }
  }

  async updateStatus(withPrices) {
    const { areas } = this.config;
    if (withPrices.length === 0) {
      await this.setStatus(
        false,
        this.lastError ? T.unreachable(this.lastError.message) : T.noPrices(areas),
      );
      return;
    }
    if (this.lastError) {
      await this.setStatus(true, T.stale(withPrices, this.lastError.message));
      return;
    }
    const tomorrow = addDays(marketDate(this.now()), 1);
    const hasTomorrow = withPrices.every((area) => this.prices.get(area).has(tomorrow));
    await this.setStatus(true, T.ok(withPrices, hasTomorrow));
  }

  // --- Energy calendars --------------------------------------------------------

  async publishCalendar(area, slots) {
    const { calendar, currency } = AREAS[area];
    for (const batch of batches(calendarEntries(slots, currency))) {
      try {
        await this.gladys.publishEnergyCalendar(calendar, batch);
      } catch (err) {
        this.logger.warn(`Calendar ${calendar}: ${err.message}`);
        return false;
      }
    }
    return true;
  }

  async readState() {
    try {
      return JSON.parse(await readFile(join(this.dataDir, STATE_FILE), 'utf8'));
    } catch {
      return {};
    }
  }

  async writeState(state) {
    try {
      await mkdir(this.dataDir, { recursive: true });
      await writeFile(join(this.dataDir, STATE_FILE), JSON.stringify(state));
    } catch (err) {
      this.logger.warn(`Writing ${STATE_FILE} failed: ${err.message}`);
    }
  }

  /**
   * Publish the last weeks of a calendar fed for the first time, so a
   * contract dated in the past is priced. Once per calendar, remembered in
   * /data; a failure is retried at the next start.
   */
  async backfill(generation) {
    const areas = this.config.areas.filter((area) => AREAS[area].calendar);
    if (areas.length === 0) {
      return;
    }
    const state = await this.readState();
    const pending = areas.filter((area) => !state[AREAS[area].calendar]);
    if (pending.length === 0) {
      return;
    }
    const today = marketDate(this.now());
    const groups = new Map();
    for (const area of pending) {
      const { currency } = AREAS[area];
      (groups.get(currency) ?? groups.set(currency, []).get(currency)).push(area);
    }
    this.logger.info(`Publishing ${BACKFILL_DAYS} days of history for ${pending.join(', ')}`);
    const done = new Set(pending);
    for (let i = BACKFILL_DAYS; i >= 1; i -= 1) {
      const date = addDays(today, -i);
      for (const [currency, group] of groups) {
        if (generation !== this.generation) {
          return;
        }
        let day;
        try {
          day = await fetchDay({ date, areas: group, currency });
        } catch (err) {
          // The portal keeps about six weeks: older days answer 401.
          if (err.status !== 401) {
            throw err;
          }
          continue;
        }
        for (const area of group) {
          if (day?.areas[area] && !(await this.publishCalendar(area, day.areas[area]))) {
            done.delete(area);
          }
        }
        await this.sleep(REQUEST_SPACING);
      }
    }
    if (generation !== this.generation) {
      return;
    }
    for (const area of done) {
      state[AREAS[area].calendar] = { backfilled_at: new Date(this.now()).toISOString() };
    }
    await this.writeState(state);
  }

  // --- Widget and action ---------------------------------------------------------

  getWidget({ settings = {}, language = 'en' } = {}) {
    const area = areaOf(this.gladys, settings.area) ?? this.config.areas[0];
    const prices = this.prices.get(area);
    const now = this.now();
    return buildWidget({
      area,
      timezone: AREAS[area]?.timezone ?? MARKET_TIMEZONE,
      currency: this.config.currency,
      prices: prices ?? new AreaPrices(area, this.config.currency),
      at: prices?.at(now, { cheapHours: this.config.cheapHours }),
      now,
      cheapHours: this.config.cheapHours,
      language,
    });
  }

  async testConnection() {
    await this.refresh();
    if (this.lastError && [...this.prices.values()].every((p) => p.slots.length === 0)) {
      return T.unreachable(this.lastError.message);
    }
    const now = this.now();
    const tomorrow = addDays(marketDate(now), 1);
    return connectionReport({
      areas: this.config.areas,
      currency: this.config.currency,
      now: new Map(
        this.config.areas.map((area) => [
          area,
          this.prices.get(area).at(now, { cheapHours: this.config.cheapHours }),
        ]),
      ),
      tomorrow: this.config.areas.every((area) => this.prices.get(area).has(tomorrow)),
    });
  }
}
