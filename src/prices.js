// -----------------------------------------------------------------------------
// The price model, pure: market dates, the slot of an instant, the statistics
// of a day, price levels, cheap hours. Prices are per kWh, instants in ms.
// -----------------------------------------------------------------------------

import { LEVELS, MARKET_TIMEZONE, SLOT_MINUTES } from './constants.js';

const dateFormats = new Map();
function dateFormat(timezone) {
  let format = dateFormats.get(timezone);
  if (!format) {
    format = new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    });
    dateFormats.set(timezone, format);
  }
  return format;
}

/** The local clock of an instant: `{ date: 'YYYY-MM-DD', hour, minute }`. */
export function localClock(t, timezone = MARKET_TIMEZONE) {
  const parts = Object.fromEntries(
    dateFormat(timezone)
      .formatToParts(new Date(t))
      .map((p) => [p.type, p.value]),
  );
  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    hour: Number(parts.hour),
    minute: Number(parts.minute),
  };
}

/** The Nord Pool market date (CET/CEST) of an instant. */
export function marketDate(t) {
  return localClock(t).date;
}

/** A calendar date plus `days` (string arithmetic on YYYY-MM-DD, in UTC). */
export function addDays(date, days) {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** The start of the slot containing `t`. */
export function slotStart(t) {
  const size = SLOT_MINUTES * 60_000;
  return Math.floor(t / size) * size;
}

/** The slot containing `t`, or undefined. `slots` are sorted. */
export function slotAt(slots, t) {
  return slots.find((s) => s.start <= t && t < s.end);
}

/** The slot starting at or after `t`, after the current one. */
export function slotAfter(slots, t) {
  const current = slotAt(slots, t);
  const from = current ? current.end : t;
  return slots.find((s) => s.start >= from);
}

/** Minimum, maximum and average of a list of slots (undefined when empty). */
export function stats(slots) {
  if (slots.length === 0) {
    return undefined;
  }
  let min = slots[0];
  let max = slots[0];
  let total = 0;
  let duration = 0;
  for (const slot of slots) {
    if (slot.price < min.price) {
      min = slot;
    }
    if (slot.price > max.price) {
      max = slot;
    }
    const length = slot.end - slot.start;
    total += slot.price * length;
    duration += length;
  }
  return { min, max, avg: total / duration };
}

/** The level of a price against an average: 'very_cheap' … 'very_expensive'. */
export function levelOf(price, avg) {
  if (!(avg > 0)) {
    // A zero or negative average: anything at or under it is very cheap.
    return price <= (avg ?? 0) ? 'very_cheap' : 'very_expensive';
  }
  const ratio = price / avg;
  return LEVELS.find(([, bound]) => ratio < bound)[0];
}

/** The starts of the `hours` cheapest hours of the day, as a Set of slot starts. */
export function cheapSlots(slots, hours) {
  const count = Math.round((hours * 60) / SLOT_MINUTES);
  const sorted = [...slots].sort((a, b) => a.price - b.price || a.start - b.start);
  return new Set(sorted.slice(0, Math.max(0, count)).map((s) => s.start));
}

/**
 * The contiguous window of `hours` hours with the lowest average price
 * (the one to charge a car or run a boiler through), or undefined when the
 * day is shorter than the window.
 */
export function cheapestWindow(slots, hours) {
  const count = Math.round((hours * 60) / SLOT_MINUTES);
  if (count <= 0 || slots.length < count) {
    return undefined;
  }
  let best;
  let sum = 0;
  for (let i = 0; i < slots.length; i += 1) {
    sum += slots[i].price;
    if (i >= count) {
      sum -= slots[i - count].price;
    }
    if (i >= count - 1) {
      const first = slots[i - count + 1];
      // Only a gapless window counts (a missing slot would shorten it).
      if (slots[i].end - first.start === count * SLOT_MINUTES * 60_000) {
        const avg = sum / count;
        if (!best || avg < best.avg) {
          best = { start: first.start, end: slots[i].end, avg };
        }
      }
    }
  }
  return best;
}

/** The slots of one market date among a list (by their start, CET date). */
export function slotsOfDate(slots, date) {
  return slots.filter((s) => marketDate(s.start) === date);
}

/**
 * The prices known for an area: the days read so far merged into one sorted
 * list of slots (today and tomorrow, typically), with what the surfaces need
 * at an instant.
 */
export class AreaPrices {
  constructor(area, currency) {
    this.area = area;
    this.currency = currency;
    // date -> { slots, final, updatedAt }
    this.days = new Map();
  }

  /** Keep a day read from Nord Pool. */
  setDay(date, { slots, final, updatedAt }) {
    this.days.set(date, { slots, final, updatedAt });
  }

  has(date) {
    return this.days.has(date);
  }

  /** Forget the days before `date` (yesterday is not needed anymore). */
  prune(date) {
    for (const key of [...this.days.keys()]) {
      if (key < date) {
        this.days.delete(key);
      }
    }
  }

  /** Every known slot, sorted. */
  get slots() {
    return [...this.days.keys()].sort().flatMap((date) => this.days.get(date).slots);
  }

  /** The slots of one market date. */
  day(date) {
    return this.days.get(date)?.slots ?? [];
  }

  /**
   * What the instant `t` looks like, against its own market day:
   * `{ slot, next, level, stats, cheap, window }`, or undefined without a
   * price for `t`.
   */
  at(t, { cheapHours = 4 } = {}) {
    const slots = this.slots;
    const slot = slotAt(slots, t);
    if (!slot) {
      return undefined;
    }
    const date = marketDate(t);
    const day = this.day(date);
    const dayStats = stats(day);
    return {
      date,
      slot,
      next: slotAfter(slots, t),
      stats: dayStats,
      level: levelOf(slot.price, dayStats.avg),
      cheap: cheapSlots(day, cheapHours).has(slot.start),
      window: cheapestWindow(day, cheapHours),
    };
  }
}
