// -----------------------------------------------------------------------------
// Scene triggers: what changed between two instants of an area. Pure.
// Keys are forever: they are stored in the users' scenes.
// -----------------------------------------------------------------------------

export const SCENE_TRIGGERS = {
  cheapStarted: 'cheap_period_started',
  cheapEnded: 'cheap_period_ended',
  levelChanged: 'price_level_changed',
  tomorrow: 'tomorrow_prices_published',
};

const round = (value) => Math.round(value * 100_000) / 100_000;

/**
 * The events to fire for an area between `previous` and `current` (both
 * `AreaPrices.at()` results, `previous` possibly undefined at the first
 * tick: nothing fires then, a restart is not a transition).
 */
export function transitions({ device, currency, previous, current }) {
  if (!previous || !current) {
    return [];
  }
  const events = [];
  const base = {
    device,
    price: round(current.slot.price),
    currency,
    level: current.level,
    ends_at: new Date(current.slot.end).toISOString(),
  };
  if (current.cheap && !previous.cheap) {
    events.push({ key: SCENE_TRIGGERS.cheapStarted, data: base });
  } else if (!current.cheap && previous.cheap) {
    events.push({ key: SCENE_TRIGGERS.cheapEnded, data: base });
  }
  if (current.level !== previous.level) {
    events.push({
      key: SCENE_TRIGGERS.levelChanged,
      data: { ...base, previous_level: previous.level },
    });
  }
  return events;
}

/** The event of a newly published day for an area (`stats`, `window`). */
export function tomorrowEvent({ device, currency, stats, window }) {
  return {
    key: SCENE_TRIGGERS.tomorrow,
    data: {
      device,
      currency,
      average: round(stats.avg),
      min: round(stats.min.price),
      max: round(stats.max.price),
      cheapest_start: window ? new Date(window.start).toISOString() : null,
      cheapest_end: window ? new Date(window.end).toISOString() : null,
    },
  };
}
