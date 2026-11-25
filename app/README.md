# Anchored Steps phone app (Year 1 + Year 2 in one App Store app)

This folder exists only on the `capacitor` branch. The website (Vercel, `main`) never uses it.

## What it is
Three pages in one package:

| Page | What | Source |
|---|---|---|
| `/index.html` | Front page: two doors, sign-in, purchases, account | `app/src/hub.jsx` |
| `/year1/index.html` | Year 1, the same code as steps.eloraradiance.com | this repo: `src/`, `public/`, `index.html` |
| `/year2/index.html` | Year 2, the same code as steps2.eloraradiance.com | `app/year2/` (a copy; see below) |

`app/src/bridge.js` is loaded first on every page and sets `window.ERApp`. Both years check for it
(`const APP = window.ERApp`): sign-in kept in the phone's storage, the header goes back to the front page, a
signed-out or locked year returns there, journal export uses the share sheet, read-aloud uses the phone's voice,
reminders are scheduled on the device. On the website `window.ERApp` never exists.

## Keeping it current
- **Year 1 changed on `main`:** merge `main` into `capacitor` (this branch adds files only, so it merges cleanly).
- **Year 2 changed:** from `app/`, run `npm run pull-year2` (copies the Year 2 repository into `app/year2` and records
  the commit in `app/year2/SOURCE.md`). Never edit `app/year2` by hand.
- Then start the Codemagic build on `capacitor`.

## Build and check
```
cd app
npm ci
npm run build        # → app/dist
npm test             # browser check with the database, App Store and phone faked (needs Playwright)
npx cap sync ios     # copies app/dist into the iOS project
```

## Purchases
`app/src/store.js`. Off until `REVENUECAT_IOS_KEY` holds the app's public RevenueCat key (`appl_…`).
Products, entitlements and the server side are described at the top of that file and in the project doc
`claude/anchored-steps-app.md`.
