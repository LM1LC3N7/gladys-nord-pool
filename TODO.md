# TODO

## Before announcing

- [ ] Test on a real Gladys 5.2+: devices, widget, the three triggers over a
      day, a "Nord Pool spot FR" contract priced from `spot-fr`.
- [ ] Reserve "Nord Pool" in the forum thread t/10385, then add the
      `gladys-assistant-integration` topic to publish in the store.
- [ ] Turn on "Private vulnerability reporting" (SECURITY.md points there).

## To confirm on a real instance

- [ ] Does the core accept a `multi_select` default (`["FR"]`) as is?
- [ ] The 15-minute calendar entries at `:15` / `:45` are accepted by the core
      (the spec says they are for a `fifteen_minutes` calendar).
- [ ] The `offset` of a `price_from_calendar` rule with a negative spot price.

## Ideas

- Delegated pricing for the twelve areas without a calendar (the store allows
  ten calendars per integration): the integration would price the intervals
  itself from a local history in `/data`.
- Hourly averages when the user wants fewer sensor changes (15-minute slots
  publish 96 values a day per sensor).
- The maintainer's list of integration ideas, by priority:
  <https://gist.github.com/Pierre-Gilles/9c4ba77a0faa47c4ea67c74351db9094>
  (Nord Pool is #34, P1).
