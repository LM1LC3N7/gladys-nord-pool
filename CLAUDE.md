# CLAUDE.md

Project rules for coding assistants (Claude Code reads this file) and for
human contributors.

## What this is

A Gladys Assistant **external integration** of type `device`: a Node.js
service (Node 22+, ESM, no build step) in its own sandboxed Docker container,
talking to Gladys through `@gladysassistant/integration-sdk` (v0.15). It
reads the **Nord Pool day-ahead electricity prices** from the public data
portal (no account) and turns them into price sensors (one device per
bidding zone), scene triggers, a dashboard widget and energy contracts
(tariff calendars + templates, Gladys 5.2+). Unofficial: not affiliated with
Nord Pool.

## Commands

```bash
npm install
npm test                                  # node --test, the built-in runner
node --test test/app.test.js              # one file
npm run lint                              # ESLint
npm run format:check                      # Prettier, as the CI runs it
npm run format                            # Prettier, fix in place
npm run audit                             # npm audit --omit=dev
npx github:GladysAssistant/integration-store .   # store admission checks
```

Run `format:check`, `lint`, `test` and `audit` before every commit.

## Architecture

```
index.js            SDK wiring only (handlers registered before connect())
src/app.js          NordPoolApp: lifecycle, hourly refresh, 15-minute tick,
                    calendars (feed + backfill), widget, action
src/nordpool.js     the data portal client: one market day -> per-kWh slots
src/prices.js       the price model (pure): market dates, slots, stats,
                    levels, cheap hours, AreaPrices
src/devices.js      area -> Gladys device + states (pure)
src/triggers.js     transitions between two instants -> scene events (pure)
src/scenes.js       scene actions: price now, cheapest window of a period (pure)
src/widget.js       the "prices" widget content (pure)
src/calendars.js    slots -> energy calendar entries (pure)
src/config.js       config_schema normalized
src/constants.js    endpoint, schedule, the AREAS table (zone, timezone,
                    currency, calendar key, VAT)
src/i18n.js         runtime texts (en/fr)
src/http.js         the only network access (fetch, timeout)
test/fixtures/      recorded portal answers (2026-10-13, EUR and SEK)
test/helpers/       fake fetch, fake timers; Gladys is the SDK's fake
```

## Rules

- **Unofficial.** Every user-facing surface (manifest description and intro,
  cover, README, docs) says "unofficial connector, not affiliated with Nord
  Pool". Never use the Nord Pool logo.
- **Keys are forever**: manifest `config_schema`, `actions`, `widgets`,
  `scene_triggers` keys, the `energy_contracts` template and calendar keys,
  the feature keys (`FEATURE` in `src/devices.js`) and the device type
  `area` of the external ids are stored in user scenes, dashboards and
  contracts. Never rename them. A calendar key names the zone (`spot-de-lu`),
  never the provider: another integration may feed the same key.
- **Prices are per kWh everywhere** (sensors, calendars, tariffs, events):
  the portal answers per MWh, `parseDay` divides once.
- **Market time is CET/CEST** (`MARKET_TIMEZONE`): a market day runs from
  22:00 or 23:00 UTC; `marketDate()` is the only way to name a day.
- **Be polite with the portal**: a read at start and every hour, tomorrow
  from 12:45 every 10 minutes until published, the backfill spaced by
  `REQUEST_SPACING`. Never poll faster.
- **Ten calendars at most** (store rule): the `calendar` key of `AREAS`
  decides which zones get one; adding one means removing another, so do
  not. The other zones keep their sensors and triggers.
- **Contract templates** are `rules` mode: the core prices them, they keep
  working when the integration is stopped. Bumping a template `version`
  never changes a user's contract silently.
- **Read-only rootfs**: write nothing outside `/data`. The only file we
  write is `/data/calendars.json` (which calendars were backfilled).
- **Versions belong to the Release workflow** (Actions → Release). Never edit
  `version` in `package.json` or in the manifest, nor the `docker_image` tag.
- **Changelog**: every user-visible change adds a line under
  `## [Unreleased]` in `CHANGELOG.md`.
- **Manifest texts** are `{ en, fr }` objects; the catalog description holds
  10 to 100 characters per language; `test/manifest.test.js` ties the
  manifest to the code.
- **User-facing text** is bilingual, `docs/en.md` and `docs/fr.md` kept in
  sync. Comments explain why, in English.
- **Tests never touch the network** (`installFetch` throws on an unknown URL).

## CI and pushes

- Group the commits and push **at most once a day**, unless the maintainer
  explicitly asks otherwise: the GitHub Actions quota is limited.
- If every CI job fails in under 2 seconds, the quota is exhausted: it is
  not a bug in the code.
- The Docker image cannot be built in the Claude Code cloud container (no
  network for `apk` inside `docker build`): the CI builds it.

## Refreshing the fixtures

```bash
D=$(date -u +%F)
curl -s "https://dataportal-api.nordpoolgroup.com/api/DayAheadPrices?date=$D&market=DayAhead&deliveryArea=FR,NL,SE3&currency=EUR" \
  | python3 -m json.tool --indent 1 > test/fixtures/dayahead-$D-eur.json
curl -s "https://dataportal-api.nordpoolgroup.com/api/DayAheadPrices?date=$D&market=DayAhead&deliveryArea=SE3&currency=SEK" \
  | python3 -m json.tool --indent 1 > test/fixtures/dayahead-$D-sek.json
```

`FIXTURE_DATE` and `FIXTURE_NOW` in `test/helpers/fakeFetch.js` and the
expected prices in `test/app.test.js` must then follow.
