# Restaurant Ops — Inventory MVP

A mobile-first, installable (PWA) prototype for the first slice of a larger
restaurant operations platform: morning inventory counting.

**Philosophy:** the employee counts and confirms; the software calculates.
No AI is used here — box/piece conversions are deterministic arithmetic
driven by a configurable product catalog (`data.js`).

## What's in this MVP

- **Employee app** (`index.html`) — pick a location, walk through product
  categories, enter quantities as full boxes + loose pieces, a box fraction
  (½, ⅓, ¼, ¾), or a direct piece count, and submit the day's inventory.
- **Manager dashboard** (`manager.html`) — see which branches have completed
  today's inventory and drill into any branch's submission history.
- **Configurable product model** — each product has a category, a unit
  (e.g. box), and a pieces-per-box conversion rate. Change `data.js` to
  reflect a different restaurant's catalog; no app code changes needed.
- **Installable PWA** — `manifest.json` + `sw.js` let the app be added to a
  phone's home screen and opened like a native app.

## What this is not (yet)

This is the small, validated first step of a much larger vision (delivery
receiving, invoice AI extraction, discrepancy detection, integrations with
existing ERP/POS/accounting systems, analytics, forecasting). Those are
deliberately out of scope until this workflow proves itself with real
employees.

## Data & persistence

For this prototype, data lives in the browser's `localStorage` (see
`storage.js`) — no backend required to try it out. The data shapes already
mirror the intended real model (`Company → Location → Employee → Product →
Inventory`), so swapping in a real API later is a matter of replacing
`storage.js`'s implementation, not the UI logic.

## Running it

Open `index.html` in a mobile browser (or serve the folder with any static
file server) for the employee flow, and `manager.html` for the manager view.
Both pages read/write the same browser storage, so submitting inventory in
the employee app immediately shows up on the dashboard.

## Next steps (see priority order in the product vision)

1. Real backend + multi-user auth (replace `storage.js`)
2. Delivery receiving with photo capture
3. AI-assisted invoice extraction (human-confirmed, never auto-applied)
4. Discrepancy detection (expected vs. actual)
5. Integrations with the customer's existing systems (only after their
   exact platform and API capabilities are verified)
