// -----------------------------------------------------------------------------
// One Gladys device per delivery area, with its price features. Pure.
// Keys are forever: the feature keys and the `area` device type are stored
// in the users' dashboards and scenes.
// -----------------------------------------------------------------------------

import {
  DEVICE_FEATURE_CATEGORIES,
  DEVICE_FEATURE_TYPES,
  DEVICE_FEATURE_UNITS,
} from '@gladysassistant/integration-sdk';
import { AREAS } from './constants.js';

export const DEVICE_TYPE = 'area';

export const FEATURE = {
  CURRENT: 'current',
  NEXT: 'next',
  AVG: 'avg',
  MIN: 'min',
  MAX: 'max',
};

const LABELS = {
  [FEATURE.CURRENT]: 'Current price',
  [FEATURE.NEXT]: 'Next price',
  [FEATURE.AVG]: "Today's average",
  [FEATURE.MIN]: "Today's minimum",
  [FEATURE.MAX]: "Today's maximum",
};

// Gladys knows a few currencies as units; the others show the bare number.
const UNITS = {
  EUR: DEVICE_FEATURE_UNITS.EURO,
};

/** The external ids of an area: `{ device, feature(key) }`. */
export function idsOf(gladys, area) {
  return gladys.externalIds(DEVICE_TYPE, area);
}

/** The area of a device external id, or undefined. */
export function areaOf(gladys, externalId) {
  const prefix = idsOf(gladys, '').device;
  if (typeof externalId !== 'string' || !externalId.startsWith(prefix)) {
    return undefined;
  }
  const area = externalId.slice(prefix.length);
  return area in AREAS ? area : undefined;
}

export function buildDevice(gladys, area, currency) {
  const ids = idsOf(gladys, area);
  const unit = UNITS[currency];
  const features = Object.values(FEATURE).map((key) => ({
    name: `${LABELS[key]} (${currency}/kWh)`,
    external_id: ids.feature(key),
    category: DEVICE_FEATURE_CATEGORIES.CURRENCY,
    type: DEVICE_FEATURE_TYPES.CURRENCY.DECIMAL,
    ...(unit ? { unit } : {}),
    read_only: true,
    has_feedback: false,
    keep_history: true,
    // Per kWh: a negative price is a credit, a few units the worst crisis.
    min: -5,
    max: 50,
  }));
  return {
    name: `Nord Pool ${area}`,
    external_id: ids.device,
    params: [{ name: 'AREA', value: area }],
    should_poll: false,
    features,
  };
}

const round = (value) => Math.round(value * 100_000) / 100_000;

/** The states of an area at an instant (`AreaPrices.at()` result). */
export function buildStates(gladys, area, at) {
  if (!at) {
    return [];
  }
  const ids = idsOf(gladys, area);
  const values = {
    [FEATURE.CURRENT]: at.slot.price,
    [FEATURE.NEXT]: at.next?.price,
    [FEATURE.AVG]: at.stats.avg,
    [FEATURE.MIN]: at.stats.min.price,
    [FEATURE.MAX]: at.stats.max.price,
  };
  return Object.entries(values)
    .filter(([, value]) => Number.isFinite(value))
    .map(([key, value]) => ({ device_feature_external_id: ids.feature(key), state: round(value) }));
}
