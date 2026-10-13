// -----------------------------------------------------------------------------
// Nord Pool data portal client: one market day of day-ahead prices for a set
// of areas in one currency, parsed into a plain day model.
//
// The portal answers per MWh: the model holds prices per kWh, the unit of
// every Gladys surface (sensors, calendars, tariffs).
// -----------------------------------------------------------------------------

import { API_URL } from './constants.js';
import { getJson } from './http.js';

/** The URL of one market day. `date` is the CET date (YYYY-MM-DD). */
export function dayUrl({ date, areas, currency }) {
  const url = new URL(API_URL);
  url.search = new URLSearchParams({
    date,
    market: 'DayAhead',
    deliveryArea: areas.join(','),
    currency,
  }).toString();
  return url.toString();
}

const num = (value) => (typeof value === 'number' && Number.isFinite(value) ? value : undefined);

/**
 * Parse a DayAheadPrices answer into `{ date, currency, updatedAt, final,
 * areas: { [area]: [{ start, end, price }] } }` with `start`/`end` in ms
 * and `price` per kWh, slots sorted. Resolves null when the answer holds no
 * usable entry (an unknown area answers 204 upstream, an empty list here).
 */
export function parseDay(answer, { currency } = {}) {
  const entries = Array.isArray(answer?.multiAreaEntries) ? answer.multiAreaEntries : [];
  const areas = {};
  for (const entry of entries) {
    const start = Date.parse(entry?.deliveryStart ?? '');
    const end = Date.parse(entry?.deliveryEnd ?? '');
    if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) {
      continue;
    }
    for (const [area, raw] of Object.entries(entry.entryPerArea ?? {})) {
      const perMwh = num(raw);
      if (perMwh === undefined) {
        continue;
      }
      // Two decimals per MWh become five per kWh: round the float noise away.
      (areas[area] ??= []).push({ start, end, price: Math.round(perMwh * 100) / 100_000 });
    }
  }
  for (const slots of Object.values(areas)) {
    slots.sort((a, b) => a.start - b.start);
  }
  if (Object.keys(areas).length === 0) {
    return null;
  }
  const states = Array.isArray(answer.areaStates) ? answer.areaStates : [];
  const final = states.every((s) => s?.state === 'Final');
  return {
    date: typeof answer.deliveryDateCET === 'string' ? answer.deliveryDateCET : undefined,
    currency: typeof answer.currency === 'string' ? answer.currency : currency,
    updatedAt: Date.parse(answer.updatedAt ?? '') || undefined,
    final,
    areas,
  };
}

/**
 * Read one market day. Resolves the parsed day, or null when Nord Pool has
 * not published it yet (204) or knows none of the areas.
 */
export async function fetchDay({ date, areas, currency }, options = {}) {
  const answer = await getJson(dayUrl({ date, areas, currency }), options);
  return answer ? parseDay(answer, { currency }) : null;
}
