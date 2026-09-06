# Restaurant Ops — Inventory MVP

A mobile-first, installable (PWA) product for the first slice of a larger
restaurant operations platform: morning inventory counting, with real
multi-tenant authentication and data isolation via Supabase.

**Philosophy:** the employee counts and confirms; the software calculates.
No AI is used here — box/piece conversions are deterministic arithmetic
against a configurable, per-organization product catalog.

## Status

Honest classification per area (see "Testing" for exactly what each claim rests on):

| Area | Status |
|---|---|
| Deterministic quantity calculations (boxes+pieces, fractions, pieces, edge cases) | **VERIFIED** — 19/19 automated tests, `tests/calculations.test.js` |
| Server-side recomputation of quantities (client can't fabricate a total) | **VERIFIED** against a real local Postgres instance |
| Cross-organization data isolation (RLS) | **VERIFIED** against a real local Postgres instance (see below) — not yet verified against the actual hosted Supabase project, since none exists yet |
| Atomic submission (no orphaned rows on partial failure) | **VERIFIED** — reproduced the old bug, confirmed the fix prevents it |
| Admin-only edit/delete of inventory history | **VERIFIED** locally |
| Employee/manager UI screens, PWA install, real Supabase Auth login | **NOT VERIFIED** — requires a real Supabase project + browser; this sandbox has no browser and cannot provision Supabase |
| Delivery receiving, invoice AI, integrations, forecasting | **NOT BUILT** — deliberately out of scope for this MVP |

### How the backend was verified without a live Supabase project

This sandbox has PostgreSQL 16 installed locally (but no Supabase account/
credentials). To actually test the RLS policies and the `submit_daily_inventory`
function — rather than just reading them — a minimal shim was created that
emulates the two Supabase-specific pieces `schema.sql` depends on
(`auth.users`, `auth.uid()`), the full schema was applied to a throwaway
local database, and a non-superuser `authenticated` role was used so RLS
was actually enforced (superusers bypass RLS entirely, which would make
the test meaningless). Two organizations, three users (two in org 1 — one
employee, one admin — and one employee in a rival org 2) were created, and
the following were run as real queries impersonating each user:

- Org 1 employee sees only org 1's 3 locations and 10 products — confirmed.
- Org 1 employee submits inventory; server recomputes the total (verified
  it stores exactly 576 for 24 boxes @ 24/box, matching the spec).
- Org 1 employee tries to submit inventory **against the rival org's
  location** → rejected by the function's own check, before RLS even needs
  to intervene.
- Rival org employee runs a raw `SELECT` against `locations`/`products`/
  `inventory_submissions` → sees only their own org's rows, zero of org 1's.
- Rival org employee attempts a raw `INSERT` directly into
  `inventory_submissions` naming org 1's `organization_id` → rejected with
  "new row violates row-level security policy".
- Org 1 employee (role `employee`) attempts to `DELETE` a historical
  submission → `DELETE 0` (silently blocked by RLS, no rows affected).
- Org 1 **admin** performs the same delete → succeeds.
- Duplicate same-day submission for one location → rejected with a unique
  constraint violation, and critically, **zero rows left behind** — verified
  by counting rows as the table owner after the rejected attempt.
- To prove the atomicity fix actually mattered: the *old* two-step
  insert-then-insert pattern was manually reproduced (insert a submission,
  skip the items insert to simulate a mid-write failure) — this did leave
  an orphaned submission row, and a legitimate retry for that same
  location+day was then permanently rejected by the unique constraint with
  no way to recover. This confirms the bug was real and that
  `submit_daily_inventory()`'s single-transaction design fixes it.

What this does *not* prove: it does not exercise Supabase's actual Auth
service (GoTrue), PostgREST's HTTP layer, or the browser-side `auth.js`/
`storage.js`/`app.js` code against a real network — only the SQL/RLS layer,
which was the part most likely to hide a real vulnerability. The browser
flow still needs a real Supabase project to verify end-to-end.

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

Run `node tests/calculations.test.js` for the pure calculation logic
(19 cases: worked spec examples, fractions, missing/empty input, unknown
modes, large numbers, and the negative-input boundary between UI clamping
and calculation logic).

The RLS/multi-tenancy/atomicity claims above were verified against a real
local PostgreSQL 16 instance with a shim for Supabase's `auth.uid()` — see
"How the backend was verified without a live Supabase project". The
browser-facing flow (login → submit inventory → manager sees it) still
needs a real Supabase project — set one up per "Setup" above to verify
end-to-end.

## Security notes

- Multi-tenant isolation is enforced by Postgres RLS, not by application
  code — verified directly, including raw-SQL cross-org attack attempts
  (see "Testing"); even a compromised or buggy frontend cannot read or
  write another organization's data through the anon key.
- Quantities are recomputed server-side inside `submit_daily_inventory()`
  from the employee's raw entered values and the product's *current*
  package size read from the database — a compromised or buggy client
  cannot forge a `normalized_quantity` by sending one directly.
- No secrets are stored client-side beyond the anon key (safe by design —
  it grants no access on its own; RLS is the actual boundary).
- Duplicate same-day submissions for a location are rejected by a unique
  database constraint, not just UI logic, and the submission is atomic:
  a failure partway through can never leave an orphaned row that blocks
  a legitimate retry (verified — see "Testing").
- Only `admin`-role profiles can edit or delete a historical inventory
  submission; `employee`/`manager` roles can insert and read but not alter
  the audit trail (verified).

## Known limitations (not yet fixed — flagging honestly rather than silently)

- **Role enforcement is partial.** RLS currently lets any authenticated
  member of an organization *read* all of that org's locations/products/
  inventory (needed today because the employee app has no concept of
  "this employee is assigned to this location only"). `manager.html` adds
  a client-side check that turns away `employee`-role profiles, but that
  is UX, not a security boundary — an employee who inspects network
  requests could still read org-wide inventory data. Closing this properly
  needs a location-assignment table and RLS policies keyed off it; tracked
  as the next phase after this one.
- **No profile self-service.** New users must be linked to an organization
  via a manual SQL `insert into profiles ...` (see Setup) — there is no
  admin UI or invite flow yet.
- **Product/location configuration is via the Supabase table editor or SQL**,
  not an in-app admin screen.
- **Offline support is not implemented.** The service worker caches the
  static app shell so it loads instantly on repeat visits, but every data
  operation (login, load products, submit inventory) requires a live
  network connection to Supabase; a submission attempted while offline
  will fail with an error, not queue for later.
- **PWA icon is a plain flat SVG**, not a proper maskable icon with safe-zone
  padding — will look slightly clipped on Android's adaptive icon shapes.

## Next steps (see priority order in the product vision)

1. Verify the Supabase setup end-to-end with a real project (see "Setup")
2. Admin UI for managing products/locations/users instead of raw SQL
3. Delivery receiving with photo capture
4. AI-assisted invoice extraction (human-confirmed, never auto-applied)
5. Discrepancy detection (expected vs. actual)
6. Integrations with the customer's existing systems (only after their
   exact platform and API capabilities are verified)
