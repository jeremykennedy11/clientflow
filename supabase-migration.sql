-- ClientFlow — Tier 2 migration
-- Run this once in the Supabase dashboard: SQL Editor → New query → paste → Run.
-- Safe to re-run; every statement is idempotent.

-- Full user object (roles, verification flags, session tokens) rides along in a jsonb column
alter table app_users add column if not exists data jsonb;

-- Entities that previously only lived in the local data.json file
create table if not exists app_firms (
  id text primary key,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists app_invitations (
  id text primary key,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists app_activity (
  id text primary key,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists app_invoices (
  id text primary key,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- Lock everything down: the server uses the secret (service) key, which bypasses RLS.
-- Enabling RLS with no policies means the public/anon key can read NOTHING. This is intended.
alter table app_users enable row level security;
alter table app_clients enable row level security;
alter table app_firms enable row level security;
alter table app_invitations enable row level security;
alter table app_activity enable row level security;
alter table app_invoices enable row level security;
