// -----------------------------------------------------------------------------
// Energy calendars: the spot prices of an area as entries of a Gladys tariff
// calendar (15-minute slots, price per kWh). Pure.
// -----------------------------------------------------------------------------

// The host API takes 2,000 entries per call: 20 days of 15-minute slots.
const BATCH = 2000;

/** The calendar entries of a list of slots. */
export function calendarEntries(slots, currency) {
  return slots.map((slot) => ({
    starts_at: new Date(slot.start).toISOString(),
    price: slot.price,
    currency,
  }));
}

/** Split entries into batches the host API accepts. */
export function batches(entries) {
  const out = [];
  for (let i = 0; i < entries.length; i += BATCH) {
    out.push(entries.slice(i, i + BATCH));
  }
  return out;
}
