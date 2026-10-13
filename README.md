# gladys-nord-pool

**Unofficial** [Gladys Assistant](https://gladysassistant.com) external
integration for the **Nord Pool day-ahead electricity prices**: 22 bidding
zones (FR, BE, NL, DE-LU, AT, PL, the Nordics and the Baltics), read from the
public data portal without any account. Not affiliated with Nord Pool AS.

- **One device per area**: current, next, average, minimum and maximum price
  per kWh, in EUR, SEK, NOK, DKK or PLN.
- **Scene triggers**: cheap period started / ended, price level changed,
  tomorrow's prices published.
- **Dashboard widget**: now, next, the day curve with the current time, the
  level and the cheapest window.
- **Energy contracts** (Gladys 5.2+): ten spot calendars and a "Nord Pool
  spot" contract template per area (spot + margin + subscription + VAT) for
  the Gladys energy monitoring.

User guide and setup: [docs/en.md](docs/en.md) · [docs/fr.md](docs/fr.md).

## How it works

```
Gladys  <-- SDK (WebSocket + host API) -->  this container
                                               ├── hourly: today (+ tomorrow from 12:45 CET)
                                               │     dataportal-api.nordpoolgroup.com
                                               ├── every 15 min: states + scene events
                                               ├── widget content on demand
                                               └── energy calendars (spot-fr, spot-de-lu…)
```

- **No key, no account**: the portal behind data.nordpoolgroup.com answers
  the day-ahead auction prices per MWh; the integration stores them per kWh.
- **Market time**: a Nord Pool day runs on CET/CEST; the sensors move every
  15 minutes (the market time unit since October 2025).
- **Calendars are shared keys**: `spot-fr` names the French zone, whichever
  integration feeds it; the store allows ten per integration, so ten zones
  get one.

## Development

```bash
npm install
npm test
npm run lint
npm run format:check
npx github:GladysAssistant/integration-store .
```

Tests never touch the network: the portal answers are recorded in
`test/fixtures/`, Gladys is the SDK's fake. Releases go through
Actions → Release (patch / minor / major), which bumps the versions, tags,
builds the multi-arch image on GHCR and publishes the GitHub Release.

## License

Apache-2.0.
