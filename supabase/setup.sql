-- True Match — minimal setup. Paste ALL of this into the Supabase SQL editor
-- and press Run. Safe to run more than once.

create extension if not exists pgcrypto;

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

create table if not exists public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  username    text        not null,
  avatar      text,                    -- data: URI, small and downscaled by the client
  created_at  timestamptz not null default now()
);

create unique index if not exists profiles_username_lower_idx
  on public.profiles (lower(username));

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

alter table public.messages replica identity full;
do $$
begin
  alter publication supabase_realtime add table public.messages;
exception
  when duplicate_object then null;
end $$;

alter table public.conversation_members replica identity full;
do $$
begin
  alter publication supabase_realtime add table public.conversation_members;
exception
  when duplicate_object then null;
end $$;

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

create or replace function public.create_account(p_username text, p_password text)
returns uuid
language plpgsql
security definer
set search_path = public, auth, extensions
as $$
declare
  uid             uuid := gen_random_uuid();
  uname           text := lower(trim(p_username));
  addr            text;
  has_provider_id boolean;
begin
  if uname !~ '^[a-z0-9_.]{3,20}$' then
    raise exception 'Username must be 3-20 characters: a-z, 0-9, dot or underscore';
  end if;
  if p_password is null or length(p_password) < 6 then
    raise exception 'Password must be at least 6 characters';
  end if;
  if exists (select 1 from public.profiles where lower(username) = uname) then
    raise exception 'That username is taken';
  end if;

  addr := uname || '@truematch.app';
  if exists (select 1 from auth.users where email = addr) then
    raise exception 'That username is taken';
  end if;

  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, created_at, updated_at,
    raw_app_meta_data, raw_user_meta_data,
    confirmation_token, recovery_token, email_change_token_new, email_change
  ) values (
    '00000000-0000-0000-0000-000000000000', uid, 'authenticated', 'authenticated',
    addr, crypt(p_password, gen_salt('bf')),
    now(), now(), now(),
    '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb,
    '', '', '', ''
  );

  -- GoTrue refuses a password login without a matching identity row, and
  -- Supabase versions disagree about whether provider_id exists.
  select exists (
    select 1 from information_schema.columns
    where table_schema = 'auth' and table_name = 'identities'
      and column_name = 'provider_id'
  ) into has_provider_id;

  if has_provider_id then
    execute format(
      'insert into auth.identities
         (id, user_id, identity_data, provider, provider_id,
          last_sign_in_at, created_at, updated_at)
       values (%L, %L, %L, %L, %L, now(), now(), now())',
      gen_random_uuid(), uid,
      json_build_object('sub', uid::text, 'email', addr)::text, 'email', uid::text
    );
  else
    execute format(
      'insert into auth.identities
         (id, user_id, identity_data, provider,
          last_sign_in_at, created_at, updated_at)
       values (%L, %L, %L, %L, now(), now(), now())',
      gen_random_uuid(), uid,
      json_build_object('sub', uid::text, 'email', addr)::text, 'email'
    );
  end if;

  insert into public.profiles (id, username) values (uid, uname);
  return uid;
end;
$$;

grant execute on function public.create_account(text, text) to anon, authenticated;

alter table public.profiles             enable row level security;
alter table public.conversations        enable row level security;
alter table public.conversation_members enable row level security;
alter table public.messages             enable row level security;

drop policy if exists "profiles are searchable" on public.profiles;
drop policy if exists "insert own profile"      on public.profiles;
drop policy if exists "update own profile"      on public.profiles;

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
