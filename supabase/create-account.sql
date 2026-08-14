-- ===========================================================================
-- Create accounts directly from SQL.
--
-- Normally the app's Sign up screen does this. Use this when sign-up is
-- blocked — most often because "Confirm email" is still switched on and
-- Supabase's built-in mailer has hit its hourly limit.
--
-- Accounts made here are confirmed immediately, so they work regardless of
-- that setting.
--
-- Run supabase/setup.sql FIRST. This depends on public.profiles existing.
-- ===========================================================================

create extension if not exists pgcrypto;

create or replace function public.admin_create_account(p_username text, p_password text)
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
  if length(p_password) < 6 then
    raise exception 'Password must be at least 6 characters';
  end if;
  if exists (select 1 from public.profiles where lower(username) = uname) then
    raise exception 'Username "%" is already taken', uname;
  end if;

  addr := uname || '@truematch.app';

  -- email_confirmed_at is set here on purpose: it is what lets the account log
  -- in even while the project still requires confirmation for normal sign-ups.
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

  -- GoTrue refuses a password login without a matching identity row. Older and
  -- newer Supabase versions disagree about whether provider_id exists, so the
  -- insert is built to match whichever this project has.
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

revoke all on function public.admin_create_account(text, text) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- MAKE YOUR ACCOUNTS — edit the usernames and passwords, then run.
-- ---------------------------------------------------------------------------
select public.admin_create_account('firstuser',  'change-this-password');
select public.admin_create_account('seconduser', 'change-this-password');

-- Check they exist:
select p.username, u.email, u.email_confirmed_at is not null as confirmed
from public.profiles p
join auth.users u on u.id = p.id
order by p.username;

-- ---------------------------------------------------------------------------
-- Delete an account (username, auth row and messages all go):
--   delete from auth.users
--   where id = (select id from public.profiles where username = 'firstuser');
--
-- Change a password:
--   update auth.users set encrypted_password = crypt('new-password', gen_salt('bf'))
--   where id = (select id from public.profiles where username = 'firstuser');
-- ---------------------------------------------------------------------------
