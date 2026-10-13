# Changelog

All notable changes to this integration are documented in this file. The format
follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project
uses [semantic versioning](https://semver.org/).

Describe each change under `## [Unreleased]` as you make it. The Release
workflow moves that section under the version it ships, and the section becomes
the notes of the version's GitHub Release.

## [Unreleased]

## [1.1.0] - 2026-10-13

### Added

- Scene actions "Nord Pool price now" (price, level, cheap hours, next
  price, today's and tomorrow's figures, cheapest window) and "Nord Pool
  cheapest hours" (the start and end of the cheapest N consecutive hours of
  the next 24 hours, the rest of today or tomorrow).

### Changed

- Shared tooling of the LM1LC3N7 Gladys integrations: CI on Node 22 and 24 with `npm audit`, Release workflow driven by this changelog, GitHub Releases from its sections, grouped Dependabot updates.

## [1.0.0] - 2026-10-13

### Added

- One device per Nord Pool delivery area (22 bidding zones) with the current,
  next, average, minimum and maximum day-ahead price per kWh, in EUR, SEK, NOK,
  DKK or PLN.
- Scene triggers "cheap period started / ended" (the N cheapest hours of the
  day), "price level changed" (very cheap to very expensive, against the
  average of the day) and "tomorrow's prices published".
- Dashboard widget "Electricity prices": now, next, today's and tomorrow's
  average, the day curve with the current time, the level and the cheapest
  window.
- Energy contracts for the Gladys energy monitoring (Gladys 5.2+): ten spot
  calendars (`spot-fr`, `spot-be`, `spot-nl`, `spot-de-lu`, `spot-at`,
  `spot-fi`, `spot-dk1`, `spot-dk2`, `spot-se3`, `spot-no1`) fed every hour
  and backfilled six weeks, and one "Nord Pool spot" contract template per
  area with the supplier margin, a monthly subscription and VAT.
- "Read the prices now" button.

[Unreleased]: https://github.com/LM1LC3N7/gladys-nord-pool/compare/v1.1.0...HEAD
[1.1.0]: https://github.com/LM1LC3N7/gladys-nord-pool/compare/v1.0.0...v1.1.0
[1.0.0]: https://github.com/LM1LC3N7/gladys-nord-pool/releases/tag/v1.0.0
