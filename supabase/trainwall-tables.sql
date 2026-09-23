-- TrainWall: screens and screen_assignments tables
-- Run this in Supabase SQL Editor

-- 1. Screens: one row per physical screen/TV
create table if not exists screens (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,          -- "Pantalla 1", "Zona Funcional"
  location     text,                   -- optional description of where it is
  access_token text not null unique default encode(gen_random_bytes(32), 'hex'),
  created_at   timestamptz not null default now()
);

-- 2. Screen assignments: what is shown on each screen right now
create table if not exists screen_assignments (
  id               uuid primary key default gen_random_uuid(),
  screen_id        uuid not null references screens(id) on delete cascade,
  session_type     text not null check (session_type in ('individual', 'group')),
  client_id        uuid references profiles(id) on delete set null,       -- individual only
  plan_session_id  uuid references plan_sessions(id) on delete set null,  -- individual only
  group_session_id uuid references group_cycle_sessions(id) on delete set null, -- group only
  assigned_by      uuid not null references profiles(id),
  started_at       timestamptz not null default now(),
  ended_at         timestamptz                                            -- null while active
);

-- Index to quickly find the active assignment for a given screen
create index if not exists screen_assignments_active_idx
  on screen_assignments (screen_id, ended_at)
  where ended_at is null;

-- RLS: screens are readable by everyone (the TV screen page is public)
alter table screens enable row level security;

create policy "screens_public_read"
  on screens for select
  using (true);

-- Only authenticated employees can manage screens
create policy "screens_employee_insert"
  on screens for insert
  to authenticated
  with check (true);

create policy "screens_employee_update"
  on screens for update
  to authenticated
  using (true);

-- RLS: screen_assignments — read by everyone (public TV page needs to read exercises)
alter table screen_assignments enable row level security;

create policy "screen_assignments_public_read"
  on screen_assignments for select
  using (true);

create policy "screen_assignments_employee_write"
  on screen_assignments for insert
  to authenticated
  with check (true);

create policy "screen_assignments_employee_update"
  on screen_assignments for update
  to authenticated
  using (true);

-- Enable Realtime on screen_assignments
-- (Run in Supabase dashboard: Database → Replication → enable screen_assignments)
-- Or via SQL:
alter publication supabase_realtime add table screen_assignments;

-- Insert the 4 screens for Girona Activa (adjust names/locations as needed)
insert into screens (name, location) values
  ('Pantalla 1', 'Zona pesos lliures'),
  ('Pantalla 2', 'Zona funcional'),
  ('Pantalla 3', 'Sala cardio'),
  ('Pantalla 4', 'Zona màquines')
on conflict do nothing;
