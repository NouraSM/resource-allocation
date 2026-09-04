-- Minimal stand-in for Supabase's auth schema, just enough for our
-- migrations/seed to apply and be smoke-tested against a plain Postgres
-- instance (used only for local SQL validation, never in production).
create schema if not exists auth;

create table auth.users (
  instance_id uuid,
  id uuid primary key,
  aud text,
  role text,
  email text,
  encrypted_password text,
  email_confirmed_at timestamptz,
  raw_app_meta_data jsonb,
  raw_user_meta_data jsonb,
  created_at timestamptz,
  updated_at timestamptz,
  confirmation_token text,
  recovery_token text,
  email_change_token_new text,
  email_change text
);

create table auth.identities (
  id uuid primary key,
  user_id uuid references auth.users (id) on delete cascade,
  provider_id text,
  identity_data jsonb,
  provider text,
  last_sign_in_at timestamptz,
  created_at timestamptz,
  updated_at timestamptz
);

create or replace function auth.uid() returns uuid
language sql stable
as $$ select null::uuid $$;
