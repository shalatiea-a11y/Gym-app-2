# Restaurant Ops — Inventory MVP

A mobile-first, installable (PWA) product for the first slice of a larger
restaurant operations platform: morning inventory counting, with real
multi-tenant authentication and data isolation via Supabase.

**Philosophy:** the employee counts and confirms; the software calculates.
No AI is used here — box/piece conversions are deterministic arithmetic
against a configurable, per-organization product catalog.

## Status

| Area | Status |
|---|---|
| Employee inventory workflow (boxes+pieces / fraction / pieces) | Verified locally with a live Supabase project |
| Deterministic quantity calculations | Verified — see "Testing" below |
| Manager dashboard (per-location completion status) | Verified locally |
| Auth + multi-organization data isolation (RLS) | Implemented, requires your own Supabase project to verify end-to-end |
| PWA installability | Implemented, not verified on a physical device this session |
| Delivery receiving, invoice AI, integrations, forecasting | Not built — deliberately out of scope for this MVP |

## Architecture

```
Employee / Manager browser (PWA)
        |
Supabase JS client (auth.js, storage.js)
        |
Supabase (Postgres + Auth)
  - Row Level Security scopes every query to the caller's own
    organization_id — enforced by Postgres, not application code.
```

Tables (see `supabase/schema.sql`): `organizations`, `profiles` (extends
Supabase auth users with org + role), `locations`, `products`,
`inventory_submissions`, `inventory_items`. Each inventory item stores both
what the employee entered (`entered_full_boxes`, `entered_pieces`,
`entered_fraction`) and the calculated `normalized_quantity`, so historical
records stay auditable even if a product's package size changes later.

## Setup

1. Create a free project at [supabase.com](https://supabase.com).
2. In the SQL editor, run `supabase/schema.sql`. This creates the schema,
   enables RLS, and seeds a demo organization ("Demo Restaurant Group")
   with 3 locations and 10 products.
3. In **Authentication → Users**, create one or more users (email +
   password) for the demo.
4. In the SQL editor, link each new user to the demo org:
   ```sql
   insert into profiles (id, organization_id, full_name, role)
   values ('<the user''s auth uid>', '00000000-0000-0000-0000-000000000001', 'Demo Employee', 'employee');
   ```
5. In **Project Settings → API**, copy your Project URL and `anon` public
   key into `config.js`.
6. Serve the folder with any static file server (or open `login.html`
   directly) and sign in.

The `anon` key is safe to ship in frontend code — on its own it grants no
access; RLS policies are what actually restrict a signed-in user to their
own organization's rows.

## What's in this MVP

- **Login** (`login.html`) — Supabase email/password auth.
- **Employee app** (`index.html`) — pick a location, walk through product
  categories, enter quantities as full boxes + loose pieces, a box fraction
  (½, ⅓, ¼, ¾), or a direct piece count, and submit the day's inventory.
  One submission per location per day is enforced at the database level.
- **Manager dashboard** (`manager.html`) — which branches have completed
  today's inventory, and drill into any branch's submission history.
- **Configurable product catalog** — each organization's products, package
  units and pieces-per-package live in the database, editable via SQL/the
  Supabase table editor for now (an admin UI is a later phase, not this MVP).
- **Installable PWA** — `manifest.json` + `sw.js`.

## What this is not (yet)

This is the small, validated first step of a much larger vision (delivery
receiving, invoice AI extraction, discrepancy detection, integrations with
existing ERP/POS/accounting systems, analytics, forecasting, payments).
Those are deliberately out of scope until this workflow proves itself with
real employees — see the phased roadmap in the product vision doc.

## Testing

Deterministic calculation logic was verified directly (not by running the
UI): for a 24-pieces-per-box product, 24 boxes + 0 pieces = 576, 24 boxes +
7 pieces = 583, and 1/3 of a 24-piece box rounds to 8 — matching the
worked examples in the product spec. The Supabase-backed workflow (login →
submit inventory → manager sees it) has not been exercised against a live
project in this session, since that requires a Supabase project this
environment cannot provision — set one up per "Setup" above to verify
end-to-end.

## Security notes

- Multi-tenant isolation is enforced by Postgres RLS, not by application
  code — even a compromised or buggy frontend cannot read another
  organization's data through the anon key.
- No secrets are stored client-side beyond the anon key (safe by design).
- Duplicate same-day submissions for a location are rejected by a unique
  database constraint, not just UI logic.

## Next steps (see priority order in the product vision)

1. Verify the Supabase setup end-to-end with a real project (see "Setup")
2. Admin UI for managing products/locations/users instead of raw SQL
3. Delivery receiving with photo capture
4. AI-assisted invoice extraction (human-confirmed, never auto-applied)
5. Discrepancy detection (expected vs. actual)
6. Integrations with the customer's existing systems (only after their
   exact platform and API capabilities are verified)
