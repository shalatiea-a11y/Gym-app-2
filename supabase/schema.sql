-- Restaurant Ops Platform — core schema
-- Run this once in your Supabase project's SQL editor.
-- Multi-tenant isolation is enforced with Postgres Row Level Security (RLS):
-- every table that holds business data carries organization_id, and every
-- policy checks it against the signed-in user's own organization via the
-- profiles table. No app code can bypass this — it's enforced by Postgres.

create extension if not exists "pgcrypto";

-- One row per restaurant company / customer of the platform.
create table organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);

-- Extends auth.users (Supabase-managed) with org membership + role.
-- Role model: employee | manager | admin. Kept simple; regional/HQ tiers
-- can be added later without changing the shape.
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  organization_id uuid not null references organizations(id) on delete cascade,
  full_name text not null,
  role text not null default 'employee' check (role in ('employee', 'manager', 'admin')),
  created_at timestamptz not null default now()
);

create table locations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  name text not null,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table products (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  name text not null,
  category text not null,
  package_unit text not null default 'box',
  units_per_package integer not null check (units_per_package > 0),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

-- One row per submitted morning inventory (one location, one day, one employee).
create table inventory_submissions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  location_id uuid not null references locations(id) on delete cascade,
  submitted_by uuid not null references profiles(id),
  submitted_at timestamptz not null default now(),
  inventory_date date not null default current_date
);

-- Line items. entered_* columns preserve exactly what the employee typed;
-- normalized_quantity is the deterministic calculation, computed by the
-- application (never by AI) at submission time and stored, not recomputed
-- silently later — this keeps historical records auditable even if a
-- product's package size changes afterwards.
create table inventory_items (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references inventory_submissions(id) on delete cascade,
  product_id uuid not null references products(id),
  entry_mode text not null check (entry_mode in ('boxes_pieces', 'fraction', 'pieces')),
  entered_full_boxes numeric,
  entered_pieces numeric,
  entered_fraction text,
  units_per_package_at_entry integer not null,
  normalized_quantity numeric not null
);

create unique index inventory_submissions_one_per_day
  on inventory_submissions (location_id, inventory_date);

-- Helper: the calling user's organization_id, looked up once per query.
create or replace function current_org_id() returns uuid
language sql stable security definer as $$
  select organization_id from profiles where id = auth.uid();
$$;

alter table organizations enable row level security;
alter table profiles enable row level security;
alter table locations enable row level security;
alter table products enable row level security;
alter table inventory_submissions enable row level security;
alter table inventory_items enable row level security;

create policy "own org only" on organizations
  for select using (id = current_org_id());

create policy "profiles in own org" on profiles
  for select using (organization_id = current_org_id());

create policy "locations in own org" on locations
  for all using (organization_id = current_org_id())
  with check (organization_id = current_org_id());

create policy "products in own org" on products
  for all using (organization_id = current_org_id())
  with check (organization_id = current_org_id());

create policy "inventory submissions in own org" on inventory_submissions
  for all using (organization_id = current_org_id())
  with check (organization_id = current_org_id());

create policy "inventory items via own org submission" on inventory_items
  for all using (
    submission_id in (select id from inventory_submissions where organization_id = current_org_id())
  )
  with check (
    submission_id in (select id from inventory_submissions where organization_id = current_org_id())
  );

-- ---------------------------------------------------------------------
-- Demo seed data. Safe to run once. Create the two demo logins afterwards
-- in Supabase Auth (see README), then insert their profiles below.
-- ---------------------------------------------------------------------
insert into organizations (id, name) values
  ('00000000-0000-0000-0000-000000000001', 'Demo Restaurant Group');

insert into locations (organization_id, name) values
  ('00000000-0000-0000-0000-000000000001', 'Downtown'),
  ('00000000-0000-0000-0000-000000000001', 'Airport Road'),
  ('00000000-0000-0000-0000-000000000001', 'Mall Branch');

insert into products (organization_id, name, category, package_unit, units_per_package) values
  ('00000000-0000-0000-0000-000000000001', 'Big Meat', 'Meat', 'box', 24),
  ('00000000-0000-0000-0000-000000000001', 'Small Meat', 'Meat', 'box', 60),
  ('00000000-0000-0000-0000-000000000001', 'Cheese Slices', 'Cheese', 'box', 100),
  ('00000000-0000-0000-0000-000000000001', 'Burger Buns', 'Bread', 'box', 48),
  ('00000000-0000-0000-0000-000000000001', 'Lettuce', 'Vegetables', 'box', 12),
  ('00000000-0000-0000-0000-000000000001', 'Tomatoes', 'Vegetables', 'box', 20),
  ('00000000-0000-0000-0000-000000000001', 'Ketchup Sachets', 'Sauces', 'box', 200),
  ('00000000-0000-0000-0000-000000000001', 'Cola Cans', 'Drinks', 'box', 24),
  ('00000000-0000-0000-0000-000000000001', 'Fry Boxes', 'Packaging', 'box', 250),
  ('00000000-0000-0000-0000-000000000001', 'Frozen Fries', 'Frozen', 'box', 10);

-- After creating a user in Supabase Auth (email/password), link them to
-- the demo org by running, with their real auth.users.id:
-- insert into profiles (id, organization_id, full_name, role)
-- values ('<auth-user-uuid>', '00000000-0000-0000-0000-000000000001', 'Demo Employee', 'employee');
