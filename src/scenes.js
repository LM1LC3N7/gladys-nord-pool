// -----------------------------------------------------------------------------
// Scene actions (manifest `scene_actions`): what a scene needs to decide,
// read from the prices the integration already holds (no request to Nord
// Pool).
//
//   get_price        the price of the moment, its level and today's figures;
//   cheapest_window  the start and end of the cheapest N consecutive hours
//                    of a period (the rest of today, tomorrow, or the next
//                    24 hours), for a following "wait until" or a timer.
// -----------------------------------------------------------------------------

import { AREAS, MARKET_TIMEZONE } from './constants.js';
import { areaOf } from './devices.js';
import { cheapestWindow, localClock, marketDate, addDays, slotStart, stats } from './prices.js';

export const SCENE_ACTIONS = { GET_PRICE: 'get_price', CHEAPEST_WINDOW: 'cheapest_window' };

// The periods a scene can ask the cheapest window of: keys are forever.
export const PERIODS = ['next_24h', 'remaining_today', 'tomorrow'];

const round4 = (v) => (Number.isFinite(v) ? Math.round(v * 10_000) / 10_000 : undefined);
const pad = (n) => String(n).padStart(2, '0');
const clockOf = (t, timezone) => {
  const c = localClock(t, timezone);
  return `${pad(c.hour)}:${pad(c.minute)}`;
};

/** The slots of a period, from `now` (sorted). */
export function periodSlots(prices, period, now) {
  const from = slotStart(now);
  const today = marketDate(now);
  switch (period) {
    case 'remaining_today':
      return prices.day(today).filter((s) => s.start >= from);
    case 'tomorrow':
      return prices.day(addDays(today, 1));
    default:
      return prices.slots.filter((s) => s.start >= from && s.start < now + 24 * 3_600_000);
  }
}

/**
 * The outputs of `cheapest_window` (pure).
 * @param {{ prices: import('./prices.js').AreaPrices, area: string, hours: number,
 *   period: string, now: number }} options
 */
export function cheapestWindowOutputs({ prices, area, hours, period, now }) {
  const timezone = AREAS[area]?.timezone ?? MARKET_TIMEZONE;
  const slots = periodSlots(prices, period, now);
  const window = cheapestWindow(slots, hours);
  const base = { area, hours, period, currency: prices.currency, found: Boolean(window) };
  if (!window) {
    return { ...base, start: '', end: '', start_time: '', end_time: '', start_day: '' };
  }
  const startDate = localClock(window.start, timezone).date;
  const today = localClock(now, timezone).date;
  return {
    ...base,
    start: new Date(window.start).toISOString(),
    end: new Date(window.end).toISOString(),
    start_time: clockOf(window.start, timezone),
    end_time: clockOf(window.end, timezone),
    start_day:
      startDate === today ? 'today' : startDate === addDays(today, 1) ? 'tomorrow' : startDate,
    starts_in_minutes: Math.max(0, Math.round((window.start - now) / 60_000)),
    avg_price: round4(window.avg),
    // Against the average of the slots considered: how much the window saves.
    saving_percent: stats(slots)?.avg
      ? Math.max(0, Math.round((1 - window.avg / stats(slots).avg) * 100))
      : 0,
  };
}

/**
 * The outputs of `get_price` (pure).
 * @param {{ prices: import('./prices.js').AreaPrices, area: string, cheapHours: number, now: number }} options
 */
export function priceOutputs({ prices, area, cheapHours, now }) {
  const timezone = AREAS[area]?.timezone ?? MARKET_TIMEZONE;
  const at = prices.at(now, { cheapHours });
  const base = { area, currency: prices.currency, found: Boolean(at) };
  if (!at) {
    return { ...base, price: null, level: '', cheap: false };
  }
  const tomorrow = prices.day(addDays(marketDate(now), 1));
  return {
    ...base,
    price: round4(at.slot.price),
    level: at.level,
    cheap: at.cheap,
    ends_at: new Date(at.slot.end).toISOString(),
    ends_time: clockOf(at.slot.end, timezone),
    next_price: round4(at.next?.price),
    avg_price: round4(at.stats.avg),
    min_price: round4(at.stats.min),
    max_price: round4(at.stats.max),
    tomorrow_published: tomorrow.length > 0,
    tomorrow_avg_price: round4(stats(tomorrow)?.avg),
    window_start: at.window ? new Date(at.window.start).toISOString() : '',
    window_end: at.window ? new Date(at.window.end).toISOString() : '',
    window_start_time: at.window ? clockOf(at.window.start, timezone) : '',
    window_end_time: at.window ? clockOf(at.window.end, timezone) : '',
  };
}

/** The area a scene field names (device external id), else the first one. */
export function areaFromFields(gladys, fields, config) {
  return areaOf(gladys, fields?.device) ?? config.areas[0];
}
