-- True Match — run this once in the Supabase SQL editor
-- (Dashboard -> SQL Editor -> New query -> paste -> Run)

create table if not exists public.messages (
  id          text primary key,
  room        text        not null,
  sender      text        not null check (sender in ('a', 'b')),
  body        text        not null default '',
  attachment  jsonb,
  status      text        not null default 'sent' check (status in ('sent', 'delivered', 'read')),
  created_at  timestamptz not null default now()
);

create index if not exists messages_room_created_idx
  on public.messages (room, created_at);

-- Realtime delivery for inserts and status updates.
alter publication supabase_realtime add table public.messages;

-- Status updates need the old row to reach subscribers reliably.
alter table public.messages replica identity full;

alter table public.messages enable row level security;

-- ---------------------------------------------------------------------------
-- IMPORTANT — read before shipping this to anyone but yourself.
--
-- These policies let ANY holder of the anon key read and write ANY room. That
-- is what makes the two test accounts work with zero sign-up friction, and it
-- is the right trade-off for a demo build. It is NOT private: the anon key is
-- embedded in the app bundle, so treat every message as readable by anyone who
-- has the APK and can guess a room code.
--
-- To make it private, add Supabase Auth and replace these with policies keyed
-- on auth.uid() plus a room_members table.
-- ---------------------------------------------------------------------------
drop policy if exists "demo read"   on public.messages;
drop policy if exists "demo insert" on public.messages;
drop policy if exists "demo update" on public.messages;

create policy "demo read"   on public.messages for select using (true);
create policy "demo insert" on public.messages for insert with check (true);
create policy "demo update" on public.messages for update using (true) with check (true);
