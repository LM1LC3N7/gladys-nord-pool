// -----------------------------------------------------------------------------
// Constants: endpoint, timeouts, schedule and the Nord Pool market geography.
// -----------------------------------------------------------------------------

export const USER_AGENT = 'gladys-nord-pool (+https://github.com/LM1LC3N7/gladys-nord-pool)';

// The public data portal behind https://data.nordpoolgroup.com (the auction
// page): no key, prices per MWh, 15-minute slots since October 2025. It
// serves about the last six weeks; older dates answer 401.
export const API_URL = 'https://dataportal-api.nordpoolgroup.com/api/DayAheadPrices';
export const HTTP_TIMEOUT = 10_000;

// The day-ahead auction clears at 12:00 CET and the prices are published
// shortly after; tomorrow is asked from 12:45 (market time) every 10 minutes
// until it comes (a 204 means "not yet").
export const MARKET_TIMEZONE = 'Europe/Oslo';
export const TOMORROW_FROM = { hour: 12, minute: 45 };
export const TOMORROW_RETRY = 10 * 60_000;
// Today and tomorrow are re-read every hour: a preliminary price can be
// corrected, and a failed read is retried.
export const REFRESH_INTERVAL = 60 * 60_000;
// After a network error, the next attempt waits this long.
export const RETRY_INTERVAL = 5 * 60_000;
export const SLOT_MINUTES = 15;

// Days of history published to the energy calendars when a calendar is fed
// for the first time: the portal keeps about six weeks.
export const BACKFILL_DAYS = 42;
// One request after another, politely.
export const REQUEST_SPACING = 500;

export const CURRENCIES = ['EUR', 'SEK', 'NOK', 'DKK', 'PLN'];

// Nord Pool delivery areas (bidding zones): their country, local timezone
// and the currency the local bills use. `calendar` is the shared key of the
// Gladys energy calendar for the zones that get one (ten at most per
// integration): the key names the zone, never the provider.
export const AREAS = {
  FR: { country: 'FR', timezone: 'Europe/Paris', currency: 'EUR', calendar: 'spot-fr', vat: 20 },
  BE: { country: 'BE', timezone: 'Europe/Brussels', currency: 'EUR', calendar: 'spot-be', vat: 6 },
  NL: {
    country: 'NL',
    timezone: 'Europe/Amsterdam',
    currency: 'EUR',
    calendar: 'spot-nl',
    vat: 21,
  },
  GER: {
    country: 'DE',
    timezone: 'Europe/Berlin',
    currency: 'EUR',
    calendar: 'spot-de-lu',
    vat: 19,
  },
  AT: { country: 'AT', timezone: 'Europe/Vienna', currency: 'EUR', calendar: 'spot-at', vat: 20 },
  FI: {
    country: 'FI',
    timezone: 'Europe/Helsinki',
    currency: 'EUR',
    calendar: 'spot-fi',
    vat: 25.5,
  },
  DK1: {
    country: 'DK',
    timezone: 'Europe/Copenhagen',
    currency: 'DKK',
    calendar: 'spot-dk1',
    vat: 25,
  },
  DK2: {
    country: 'DK',
    timezone: 'Europe/Copenhagen',
    currency: 'DKK',
    calendar: 'spot-dk2',
    vat: 25,
  },
  SE3: {
    country: 'SE',
    timezone: 'Europe/Stockholm',
    currency: 'SEK',
    calendar: 'spot-se3',
    vat: 25,
  },
  NO1: { country: 'NO', timezone: 'Europe/Oslo', currency: 'NOK', calendar: 'spot-no1', vat: 25 },
  SE1: { country: 'SE', timezone: 'Europe/Stockholm', currency: 'SEK', vat: 25 },
  SE2: { country: 'SE', timezone: 'Europe/Stockholm', currency: 'SEK', vat: 25 },
  SE4: { country: 'SE', timezone: 'Europe/Stockholm', currency: 'SEK', vat: 25 },
  NO2: { country: 'NO', timezone: 'Europe/Oslo', currency: 'NOK', vat: 25 },
  NO3: { country: 'NO', timezone: 'Europe/Oslo', currency: 'NOK', vat: 25 },
  NO4: { country: 'NO', timezone: 'Europe/Oslo', currency: 'NOK', vat: 25 },
  NO5: { country: 'NO', timezone: 'Europe/Oslo', currency: 'NOK', vat: 25 },
  EE: { country: 'EE', timezone: 'Europe/Tallinn', currency: 'EUR', vat: 24 },
  LT: { country: 'LT', timezone: 'Europe/Vilnius', currency: 'EUR', vat: 21 },
  LV: { country: 'LV', timezone: 'Europe/Riga', currency: 'EUR', vat: 21 },
  PL: { country: 'PL', timezone: 'Europe/Warsaw', currency: 'PLN', vat: 23 },
};

// Price levels against the average of the day (Tibber's thresholds, which
// Home Assistant users know): the ratio bounds of each level.
export const LEVELS = [
  ['very_cheap', 0.6],
  ['cheap', 0.9],
  ['normal', 1.15],
  ['expensive', 1.4],
  ['very_expensive', Infinity],
];
