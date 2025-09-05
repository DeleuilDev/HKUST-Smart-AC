-- Smart AC – Initial schema for Supabase/Postgres
-- Notes:
-- - Assumes Supabase environment (auth schema, auth.uid()).
-- - Uses pgcrypto for gen_random_uuid().

create extension if not exists pgcrypto;
create extension if not exists "uuid-ossp";

-- ENUMs
do $$ begin
  create type member_role as enum ('resident','ra','admin');
exception when duplicate_object then null; end $$;

do $$ begin
  create type timer_status as enum ('scheduled','running','canceled','completed');
exception when duplicate_object then null; end $$;

-- USERS
create table if not exists public.users (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  student_id text not null unique,
  surname text,
  given_names text,
  full_name text,
  session_version integer not null default 1,
  last_login_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Simplified: one table for location data (optional fields, minimal constraints)
create table if not exists public.spaces (
  id bigserial primary key,
  hall_code text,
  hall_name text,
  room text,
  bed text,
  campus text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

-- MEMBERSHIPS
create table if not exists public.room_memberships (
  id bigserial primary key,
  user_id uuid not null references public.users(id) on delete cascade,
  space_id bigint not null references public.spaces(id) on delete cascade,
  role member_role not null default 'resident',
  start_date date not null default (now() at time zone 'utc')::date,
  end_date date,
  created_at timestamptz not null default now()
);

create index if not exists idx_room_memberships_user_active on public.room_memberships (user_id) where end_date is null;
create index if not exists idx_room_memberships_space on public.room_memberships (space_id);

-- AC UNITS
create table if not exists public.ac_units (
  id bigserial primary key,
  space_id bigint not null references public.spaces(id) on delete cascade,
  device_id text,
  power_state boolean not null default false,
  emergency_mode boolean not null default false,
  emergency_reason text,
  last_seen_at timestamptz,
  firmware_version text,
  created_at timestamptz not null default now()
);

create index if not exists idx_ac_units_space on public.ac_units (space_id);

-- AC ACCOUNTS (prepaid minutes)
create table if not exists public.ac_accounts (
  id bigserial primary key,
  space_id bigint not null references public.spaces(id) on delete cascade,
  charge_type text not null default 'prepaid',
  minutes_balance integer not null default 0 check (minutes_balance >= 0),
  billing_cycle_day integer not null default 1 check (billing_cycle_day between 1 and 28),
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists idx_ac_accounts_space on public.ac_accounts (space_id);

-- TIMERS
create table if not exists public.ac_timers (
  id bigserial primary key,
  account_id bigint not null references public.ac_accounts(id) on delete cascade,
  ac_unit_id bigint not null references public.ac_units(id) on delete cascade,
  created_by uuid references public.users(id) on delete set null,
  start_at timestamptz not null,
  end_at timestamptz not null,
  status timer_status not null default 'scheduled',
  created_at timestamptz not null default now()
);

create index if not exists idx_ac_timers_account_start on public.ac_timers (account_id, start_at);

-- USAGE SESSIONS
create table if not exists public.ac_usage_sessions (
  id bigserial primary key,
  account_id bigint not null references public.ac_accounts(id) on delete cascade,
  ac_unit_id bigint not null references public.ac_units(id) on delete cascade,
  started_by uuid references public.users(id) on delete set null,
  ended_by uuid references public.users(id) on delete set null,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  duration_minutes integer,
  minutes_deducted integer,
  created_at timestamptz not null default now()
);

create index if not exists idx_ac_usage_account_started on public.ac_usage_sessions (account_id, started_at desc);

-- TOP UPS
create table if not exists public.top_ups (
  id bigserial primary key,
  account_id bigint not null references public.ac_accounts(id) on delete cascade,
  user_id uuid references public.users(id) on delete set null,
  amount_minutes integer not null check (amount_minutes > 0),
  source text,
  reference text,
  created_at timestamptz not null default now()
);

create index if not exists idx_topups_account_created on public.top_ups (account_id, created_at desc);

-- CAS TOKENS (server-only access)
create table if not exists public.cas_tokens (
  id bigserial primary key,
  user_id uuid not null references public.users(id) on delete cascade,
  token_hash text not null unique,
  issued_at timestamptz not null default now(),
  expires_at timestamptz not null,
  consumed_at timestamptz,
  payload jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_cas_tokens_user on public.cas_tokens (user_id);
create index if not exists idx_cas_tokens_expires on public.cas_tokens (expires_at);
create unique index if not exists uq_cas_tokens_user on public.cas_tokens (user_id);

-- Helper function for updated_at (idempotent)
create or replace function public.set_current_timestamp_updated_at()
returns trigger
language plpgsql
as $fn$
begin
  new.updated_at = now();
  return new;
end;
$fn$;

-- Trigger to maintain updated_at on users
drop trigger if exists set_users_updated_at on public.users;
create trigger set_users_updated_at
before update on public.users
for each row execute procedure public.set_current_timestamp_updated_at();

-- RLS
alter table public.users enable row level security;
alter table public.spaces enable row level security;
alter table public.room_memberships enable row level security;
alter table public.ac_units enable row level security;
alter table public.ac_accounts enable row level security;
alter table public.ac_timers enable row level security;
alter table public.ac_usage_sessions enable row level security;
alter table public.top_ups enable row level security;
alter table public.cas_tokens enable row level security;

-- SCHEDULED ACTIONS (for server scheduler)
create table if not exists public.scheduled_actions (
  id bigserial primary key,
  user_id uuid not null references public.users(id) on delete cascade,
  type text not null,
  payload jsonb,
  status text not null default 'pending' check (status in ('pending','running','completed','failed','canceled')),
  scheduled_at timestamptz not null,
  executed_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_sched_user on public.scheduled_actions(user_id);
create index if not exists idx_sched_pending on public.scheduled_actions(status) where status = 'pending';
alter table public.scheduled_actions enable row level security;

-- USERS policies
drop policy if exists "Users: self select" on public.users;
create policy "Users: self select" on public.users
  for select using (auth.uid() = id);

drop policy if exists "Users: self update" on public.users;
create policy "Users: self update" on public.users
  for update using (auth.uid() = id);

-- SPACES are readable by any authenticated user (or restrict to members only; pick one)
drop policy if exists "Spaces: auth select" on public.spaces;
create policy "Spaces: auth select" on public.spaces
  for select using (true);

-- If you prefer stricter: comment out above and use membership-based select
-- drop policy if exists "Spaces: member select" on public.spaces;
-- create policy "Spaces: member select" on public.spaces
--   for select using (
--     exists (
--       select 1 from public.room_memberships m
--       where m.space_id = spaces.id and m.user_id = auth.uid() and m.end_date is null
--     )
--   );

-- MEMBERSHIPS: user can see own memberships
drop policy if exists "Memberships: self select" on public.room_memberships;
create policy "Memberships: self select" on public.room_memberships
  for select using (user_id = auth.uid());

-- AC_UNITS readable if user has membership to the room
drop policy if exists "AC Units: member select" on public.ac_units;
create policy "AC Units: member select" on public.ac_units
  for select using (
    exists (
      select 1 from public.room_memberships m
      where m.space_id = ac_units.space_id and m.user_id = auth.uid() and m.end_date is null
    )
  );

-- AC_ACCOUNTS readable if user has membership to the room
drop policy if exists "AC Accounts: member select" on public.ac_accounts;
create policy "AC Accounts: member select" on public.ac_accounts
  for select using (
    exists (
      select 1 from public.room_memberships m
      where m.space_id = ac_accounts.space_id and m.user_id = auth.uid() and m.end_date is null
    )
  );

-- TIMERS readable/insertable if user is member and creator
drop policy if exists "Timers: member select" on public.ac_timers;
create policy "Timers: member select" on public.ac_timers
  for select using (
    exists (
      select 1 from public.ac_accounts a
      join public.room_memberships m on m.space_id = a.space_id
      where a.id = ac_timers.account_id and m.user_id = auth.uid() and m.end_date is null
    )
  );

drop policy if exists "Timers: member insert" on public.ac_timers;
create policy "Timers: member insert" on public.ac_timers
  for insert with check (
    created_by = auth.uid() and exists (
      select 1 from public.ac_accounts a
      join public.room_memberships m on m.space_id = a.space_id
      where a.id = ac_timers.account_id and m.user_id = auth.uid() and m.end_date is null
    )
  );

-- USAGE SESSIONS readable if user is member
drop policy if exists "Usage: member select" on public.ac_usage_sessions;
create policy "Usage: member select" on public.ac_usage_sessions
  for select using (
    exists (
      select 1 from public.ac_accounts a
      join public.room_memberships m on m.space_id = a.space_id
      where a.id = ac_usage_sessions.account_id and m.user_id = auth.uid() and m.end_date is null
    )
  );

-- TOP UPS readable if user is member
drop policy if exists "TopUps: member select" on public.top_ups;
create policy "TopUps: member select" on public.top_ups
  for select using (
    exists (
      select 1 from public.ac_accounts a
      join public.room_memberships m on m.space_id = a.space_id
      where a.id = top_ups.account_id and m.user_id = auth.uid() and m.end_date is null
    )
  );

-- CAS TOKENS: no client access (intentionally no policies for insert/select/update/delete)
-- Use service role in API only.

-- Scheduled actions: self select
drop policy if exists "Scheduled: self select" on public.scheduled_actions;
create policy "Scheduled: self select" on public.scheduled_actions
  for select using (user_id = auth.uid());
