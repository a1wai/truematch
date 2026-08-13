-- ===========================================================================
-- True Match — beta schema (accounts, contacts, conversations, messages)
--
-- Run once in the Supabase SQL editor:
--   Dashboard -> SQL Editor -> New query -> paste -> Run
--
-- ONE MANUAL STEP IS REQUIRED AS WELL:
--   Authentication -> Sign In / Providers -> Email -> turn "Confirm email" OFF.
--   Accounts here are username + password, so there is no inbox to confirm
--   from. With confirmation on, sign-up succeeds but login always fails.
-- ===========================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Migration from the first build.
--
-- That version had a room-based `messages` table (room text, no
-- conversation_id). `create table if not exists` silently skips it, and then
-- the index below fails with: column "conversation_id" does not exist.
--
-- Only the legacy shape is dropped — a `messages` table that already has
-- conversation_id is left alone, so re-running this file never destroys real
-- conversations.
-- ---------------------------------------------------------------------------
do $$
begin
  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'messages'
  ) and not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'messages'
      and column_name = 'conversation_id'
  ) then
    drop table public.messages cascade;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Profiles: one row per account, keyed to Supabase Auth.
-- The app signs up with a synthetic address (<username>@truematch.app) so that
-- Supabase Auth still handles password hashing, sessions and refresh tokens —
-- the username is what people actually see and search by.
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  username    text        not null,
  avatar      text,                    -- data: URI, small and downscaled by the client
  created_at  timestamptz not null default now()
);

-- Usernames are case-insensitive for uniqueness and lookup.
create unique index if not exists profiles_username_lower_idx
  on public.profiles (lower(username));

-- ---------------------------------------------------------------------------
-- Conversations
-- ---------------------------------------------------------------------------
create table if not exists public.conversations (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz not null default now()
);

create table if not exists public.conversation_members (
  conversation_id uuid references public.conversations (id) on delete cascade,
  user_id         uuid references public.profiles (id) on delete cascade,
  primary key (conversation_id, user_id)
);

create index if not exists conversation_members_user_idx
  on public.conversation_members (user_id);

create table if not exists public.messages (
  id              text primary key,
  conversation_id uuid        not null references public.conversations (id) on delete cascade,
  sender          uuid        not null references public.profiles (id) on delete cascade,
  body            text        not null default '',
  attachment      jsonb,      -- { kind, name, src (data URI), width, height }
  status          text        not null default 'sent'
                              check (status in ('sent', 'delivered', 'read')),
  created_at      timestamptz not null default now()
);

create index if not exists messages_conversation_created_idx
  on public.messages (conversation_id, created_at);

-- Realtime delivery, and full old-row data so status updates reach subscribers.
alter table public.messages replica identity full;
do $$
begin
  alter publication supabase_realtime add table public.messages;
exception
  when duplicate_object then null;
end $$;

-- ---------------------------------------------------------------------------
-- Membership check as SECURITY DEFINER.
-- A policy on conversation_members that queries conversation_members recurses
-- forever; routing through a definer function breaks that cycle.
-- ---------------------------------------------------------------------------
create or replace function public.is_member(conv uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.conversation_members m
    where m.conversation_id = conv and m.user_id = auth.uid()
  );
$$;

-- ---------------------------------------------------------------------------
-- Open (or reopen) the 1:1 conversation between the caller and someone else.
-- Done server-side so two people tapping at once cannot create two rooms.
-- ---------------------------------------------------------------------------
create or replace function public.start_direct_conversation(other uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  conv uuid;
begin
  if auth.uid() is null then
    raise exception 'not signed in';
  end if;
  if other = auth.uid() then
    raise exception 'cannot start a conversation with yourself';
  end if;

  select m1.conversation_id into conv
  from public.conversation_members m1
  join public.conversation_members m2 on m1.conversation_id = m2.conversation_id
  where m1.user_id = auth.uid() and m2.user_id = other
  limit 1;

  if conv is null then
    insert into public.conversations default values returning id into conv;
    insert into public.conversation_members (conversation_id, user_id)
    values (conv, auth.uid()), (conv, other);
  end if;

  return conv;
end;
$$;

-- ---------------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------------
alter table public.profiles             enable row level security;
alter table public.conversations        enable row level security;
alter table public.conversation_members enable row level security;
alter table public.messages             enable row level security;

drop policy if exists "profiles are searchable" on public.profiles;
drop policy if exists "insert own profile"      on public.profiles;
drop policy if exists "update own profile"      on public.profiles;

-- Usernames and avatars are public so people can be found and added. Nothing
-- private lives on this table.
create policy "profiles are searchable" on public.profiles
  for select using (true);
create policy "insert own profile" on public.profiles
  for insert with check (id = auth.uid());
create policy "update own profile" on public.profiles
  for update using (id = auth.uid()) with check (id = auth.uid());

drop policy if exists "read own conversations"   on public.conversations;
drop policy if exists "create conversations"     on public.conversations;

create policy "read own conversations" on public.conversations
  for select using (public.is_member(id));
create policy "create conversations" on public.conversations
  for insert with check (auth.uid() is not null);

drop policy if exists "read own memberships" on public.conversation_members;
drop policy if exists "join conversations"   on public.conversation_members;

create policy "read own memberships" on public.conversation_members
  for select using (user_id = auth.uid() or public.is_member(conversation_id));
create policy "join conversations" on public.conversation_members
  for insert with check (auth.uid() is not null);

drop policy if exists "read conversation messages"  on public.messages;
drop policy if exists "send conversation messages"  on public.messages;
drop policy if exists "update conversation messages" on public.messages;

create policy "read conversation messages" on public.messages
  for select using (public.is_member(conversation_id));
create policy "send conversation messages" on public.messages
  for insert with check (sender = auth.uid() and public.is_member(conversation_id));
create policy "update conversation messages" on public.messages
  for update using (public.is_member(conversation_id))
  with check (public.is_member(conversation_id));

-- ---------------------------------------------------------------------------
-- What this does and does not protect
--
--   Messages are readable only by members of that conversation, enforced by
--   Postgres rather than by the client. The anon key alone gets a stranger
--   nothing without a valid login.
--
--   Profiles (username + avatar) are public by design — that is what makes
--   "add someone by username" work.
--
--   Anyone signed in can insert a membership row if they can guess a
--   conversation UUID. UUIDs are not guessable in practice, but if this grows
--   past beta, tighten "join conversations" to inserts made by
--   start_direct_conversation only.
--
--   There is no password recovery. Losing the password means losing the
--   account unless an admin resets it from the dashboard.
-- ---------------------------------------------------------------------------
