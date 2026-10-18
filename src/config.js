// -----------------------------------------------------------------------------
// The configuration the user fills (manifest `config_schema`), normalized:
// the rest of the code never deals with `undefined` or strings from a form.
// -----------------------------------------------------------------------------

import { AREAS, CURRENCIES } from './constants.js';

// Defaults: they MUST match the `default` values of the manifest.
export const DEFAULTS = {
  areas: ['FR'],
  currency: 'EUR',
  cheap_hours: 4,
};

const AREA_ORDER = Object.keys(AREAS);

/**
 * The areas of a form value (an array, or a comma-separated string), in the
 * order of AREAS whatever the order of the form: the widget without a chosen
 * area shows the first one, which must not depend on the click order.
 */
function areaList(value) {
  const raw = Array.isArray(value) ? value : String(value ?? '').split(',');
  const areas = new Set(raw.map((a) => String(a).trim().toUpperCase()));
  return AREA_ORDER.filter((a) => areas.has(a));
}

export function normalizeConfig(raw = {}) {
  const areas = areaList(raw.areas);
  const currency = String(raw.currency ?? '')
    .trim()
    .toUpperCase();
  const cheapHours = Number(raw.cheap_hours ?? DEFAULTS.cheap_hours);
  return {
    areas: areas.length > 0 ? areas : DEFAULTS.areas,
    currency: CURRENCIES.includes(currency) ? currency : DEFAULTS.currency,
    cheapHours:
      Number.isFinite(cheapHours) && cheapHours >= 1 && cheapHours <= 12
        ? Math.round(cheapHours)
        : DEFAULTS.cheap_hours,
  };
}
