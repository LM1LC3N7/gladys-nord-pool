// -----------------------------------------------------------------------------
// The "prices" dashboard widget: now, next, today's average, the day curve
// with the current time, the level and the cheapest window. Pure.
// -----------------------------------------------------------------------------

import { WIDGET_COLORS } from '@gladysassistant/integration-sdk';
import { T } from './i18n.js';
import { addDays, stats } from './prices.js';

const SYMBOLS = { EUR: '€', SEK: 'kr', NOK: 'kr', DKK: 'kr', PLN: 'zł' };

const LEVEL_COLORS = {
  very_cheap: WIDGET_COLORS.SUCCESS,
  cheap: WIDGET_COLORS.SUCCESS,
  normal: WIDGET_COLORS.NEUTRAL,
  expensive: WIDGET_COLORS.WARNING,
  very_expensive: WIDGET_COLORS.DANGER,
};

const round3 = (value) => Math.round(value * 1000) / 1000;

const clockFormats = new Map();
function clock(t, timezone, language) {
  const key = `${timezone}|${language}`;
  let format = clockFormats.get(key);
  if (!format) {
    format = new Intl.DateTimeFormat(language === 'fr' ? 'fr-FR' : 'en-GB', {
      timeZone: timezone,
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    });
    clockFormats.set(key, format);
  }
  return format.format(new Date(t));
}

/**
 * The widget content of an area. `prices` is its AreaPrices, `at` the
 * `prices.at(now)` result (undefined without a price for now).
 */
export function buildWidget({ area, timezone, currency, prices, at, now, cheapHours, language }) {
  const unit = `${SYMBOLS[currency] ?? currency}/kWh`;
  const components = [{ type: 'text', variant: 'heading', text: `Nord Pool ${area}` }];
  if (!at) {
    components.push({ type: 'text', variant: 'body', text: T.widget.noData });
    return { ttl_seconds: 300, components };
  }
  components.push(
    {
      type: 'value',
      value: round3(at.slot.price),
      unit,
      label: T.widget.now,
      icon: 'zap',
      color: LEVEL_COLORS[at.level],
    },
    ...(at.next
      ? [{ type: 'value', value: round3(at.next.price), unit, label: T.widget.next }]
      : []),
    { type: 'value', value: round3(at.stats.avg), unit, label: T.widget.today },
  );
  const tomorrowDate = addDays(at.date, 1);
  const tomorrow = prices.day(tomorrowDate);
  const tomorrowStats = stats(tomorrow);
  if (tomorrowStats) {
    components.push({
      type: 'value',
      value: round3(tomorrowStats.avg),
      unit,
      label: T.widget.tomorrow,
    });
  }
  // The curve: today and tomorrow in one step series, at most 192 points.
  const points = [...prices.day(at.date), ...tomorrow].map((s) => ({
    t: new Date(s.start).toISOString(),
    v: round3(s.price),
  }));
  const last = tomorrow.at(-1) ?? prices.day(at.date).at(-1);
  if (last) {
    // The last step needs its end to be drawn.
    points.push({ t: new Date(last.end).toISOString(), v: round3(last.price) });
  }
  components.push({
    type: 'chart',
    chart_type: 'stepline',
    title: T.widget.chart,
    unit,
    series: [{ name: `${currency}/kWh`, points }],
    now_marker: true,
    annotations: [
      {
        t: new Date(at.stats.min.start).toISOString(),
        value: round3(at.stats.min.price),
        label: T.widget.min,
        color: WIDGET_COLORS.SUCCESS,
      },
      {
        t: new Date(at.stats.max.start).toISOString(),
        value: round3(at.stats.max.price),
        label: T.widget.max,
        color: WIDGET_COLORS.DANGER,
      },
    ],
  });
  const items = [
    {
      label: T.widget.levelRow,
      value: T.level[at.level],
      color: LEVEL_COLORS[at.level],
      icon: 'activity',
    },
  ];
  if (at.window) {
    const running = at.window.start <= now && now < at.window.end;
    items.push({
      label: T.widget.cheapest(cheapHours),
      value: `${clock(at.window.start, timezone, language)} – ${clock(at.window.end, timezone, language)}`,
      color: running ? WIDGET_COLORS.SUCCESS : WIDGET_COLORS.NEUTRAL,
      icon: 'clock',
    });
  }
  items.push({
    label: T.widget.tomorrowRow,
    value: tomorrowStats ? T.widget.published : T.widget.notYet,
    color: tomorrowStats ? WIDGET_COLORS.SUCCESS : WIDGET_COLORS.NEUTRAL,
    icon: 'calendar',
  });
  components.push({ type: 'status', items });
  return { ttl_seconds: 300, components };
}
