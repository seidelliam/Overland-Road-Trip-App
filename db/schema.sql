-- Road Trip Planner schema
-- Run in the Supabase SQL editor.
--
-- Auth model: there is no per-user auth. The trip `code` is the access token —
-- anyone with the code can read and edit. RLS is enabled with permissive
-- policies so the anon key works directly; we trust the application to gate
-- access by code in the URL.

create extension if not exists "pgcrypto";

-- ============================================================
-- Tables
-- ============================================================

create table if not exists trips (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  name text not null,
  description text,
  start_date date,
  end_date date,
  travelers int default 1,
  origin_label text,
  origin_lng double precision,
  origin_lat double precision,
  destination_label text,
  destination_lng double precision,
  destination_lat double precision,
  car_year int,
  car_make text,
  car_model text,
  car_trim text,
  car_mpg numeric(6,1),               -- EPA combined MPG for the selected vehicle
  gas_price numeric(6,2),             -- optional manual $/gal override; null = use per-state averages
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists routes (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references trips(id) on delete cascade,
  name text not null,
  color text not null default '#10b981',
  notes text,
  position int not null default 0,
  geometry jsonb,                 -- cached GeoJSON LineString from Mapbox Directions
  distance_meters double precision,
  duration_seconds double precision,
  legs jsonb,                     -- cached per-leg [{distance,duration}] between consecutive waypoints
  states jsonb,                   -- cached US state codes the route passes through, e.g. ["CO","UT"]
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists stops (
  id uuid primary key default gen_random_uuid(),
  route_id uuid not null references routes(id) on delete cascade,
  name text not null,
  category text not null default 'waypoint',  -- waypoint | overnight | food | gas | attraction | scenic
  lng double precision not null,
  lat double precision not null,
  address text,
  notes text,
  position int not null default 0,
  estimated_cost numeric(10,2),
  arrival_date date,
  nights int default 0,
  created_at timestamptz not null default now()
);

create table if not exists budget_items (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references trips(id) on delete cascade,
  route_id uuid references routes(id) on delete cascade,
  category text not null,  -- gas | food | lodging | activities | other
  label text not null,
  amount numeric(10,2) not null default 0,
  created_at timestamptz not null default now()
);

-- ============================================================
-- Indexes
-- ============================================================

create index if not exists trips_code_idx on trips(code);
create index if not exists routes_trip_id_idx on routes(trip_id);
create index if not exists stops_route_id_idx on stops(route_id);
create index if not exists budget_trip_id_idx on budget_items(trip_id);

-- ============================================================
-- Updated_at trigger
-- ============================================================

create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trips_updated_at on trips;
create trigger trips_updated_at before update on trips
  for each row execute function set_updated_at();

drop trigger if exists routes_updated_at on routes;
create trigger routes_updated_at before update on routes
  for each row execute function set_updated_at();

-- ============================================================
-- Row Level Security (permissive — code in URL is the auth)
-- ============================================================

alter table trips enable row level security;
alter table routes enable row level security;
alter table stops enable row level security;
alter table budget_items enable row level security;

drop policy if exists "anon all trips" on trips;
create policy "anon all trips" on trips for all to anon using (true) with check (true);

drop policy if exists "anon all routes" on routes;
create policy "anon all routes" on routes for all to anon using (true) with check (true);

drop policy if exists "anon all stops" on stops;
create policy "anon all stops" on stops for all to anon using (true) with check (true);

drop policy if exists "anon all budget" on budget_items;
create policy "anon all budget" on budget_items for all to anon using (true) with check (true);

-- ============================================================
-- Migrations (safe to run against an existing database)
-- ============================================================
-- 2026-05 — Vehicle + per-state gas pricing
alter table trips add column if not exists car_year int;
alter table trips add column if not exists car_make text;
alter table trips add column if not exists car_model text;
alter table trips add column if not exists car_trim text;
alter table trips add column if not exists car_mpg numeric(6,1);
alter table trips add column if not exists gas_price numeric(6,2);
alter table routes add column if not exists states jsonb;

-- 2026-05 — Per-leg drive distances (how far each day's drive is)
alter table routes add column if not exists legs jsonb;
