-- ===========================================================================
-- True Match — push notifications when the app is closed
--
-- Run this AFTER supabase/setup.sql. It is safe to run more than once.
--
-- What this adds:
--   * device_tokens — one row per phone, so the server knows where to send
--   * a trigger on messages that asks an Edge Function to deliver a push
--
-- It does nothing on its own. The Edge Function in supabase/functions/push
-- has to be deployed and the config row at the bottom filled in. Until
-- then the trigger is a no-op and messaging is unaffected.
-- ===========================================================================

-- pg_net creates and owns the "net" schema; it cannot be relocated.
create extension if not exists pg_net;

-- ---------------------------------------------------------------------------
-- Where to send
-- ---------------------------------------------------------------------------
create table if not exists public.device_tokens (
  token      text primary key,
  user_id    uuid not null references public.profiles(id) on delete cascade,
  platform   text not null default 'android',
  updated_at timestamptz not null default now()
);

create index if not exists device_tokens_user_idx on public.device_tokens (user_id);

alter table public.device_tokens enable row level security;

drop policy if exists "manage own device tokens" on public.device_tokens;

-- A device token is not a secret worth guarding from its owner, but it is
-- nobody else's business either: you can only see and change your own.
create policy "manage own device tokens" on public.device_tokens
  for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Config, kept out of reach of the app
--
-- A schema with no grants to anon or authenticated. The trigger below is
-- SECURITY DEFINER, so it can read this while the API cannot.
-- ---------------------------------------------------------------------------
create schema if not exists private;
revoke all on schema private from anon, authenticated;

create table if not exists private.push_config (
  id       int primary key default 1,
  endpoint text,
  secret   text,
  constraint push_config_single_row check (id = 1)
);

revoke all on private.push_config from anon, authenticated;

-- The trigger below swallows its own errors so a push problem can never
-- stop someone sending a message. That would otherwise hide a mistake
-- forever, so the error is written here instead:
--
--   select * from private.push_failures order by at desc limit 20;
create table if not exists private.push_failures (
  at         timestamptz not null default now(),
  -- text, not uuid: message ids are generated on the device, not by the
  -- database, and are not UUIDs.
  message_id text,
  reason     text
);

revoke all on private.push_failures from anon, authenticated;

-- ---------------------------------------------------------------------------
-- The trigger
--
-- Fires and forgets: net.http_post queues the request and returns
-- immediately, so sending a message never waits on push delivery, and a
-- push outage cannot stop the chat from working.
-- ---------------------------------------------------------------------------
create or replace function public.on_message_push()
returns trigger
language plpgsql
security definer
set search_path = public, private, net, extensions
as $$
declare
  cfg private.push_config%rowtype;
begin
  select * into cfg from private.push_config where id = 1;

  -- Not configured yet. Do nothing, quietly.
  if cfg.endpoint is null or cfg.endpoint = '' then
    return new;
  end if;

  perform net.http_post(
    url     := cfg.endpoint,
    headers := jsonb_build_object(
                 'Content-Type', 'application/json',
                 'Authorization', 'Bearer ' || coalesce(cfg.secret, '')
               ),
    body    := jsonb_build_object(
                 'message_id',      new.id,
                 'conversation_id', new.conversation_id,
                 'sender',          new.sender,
                 'body',            new.body,
                 'has_attachment',  new.attachment is not null
               )
  );
  return new;
exception
  when others then
    -- Never let a push problem block someone sending a message. Leave a
    -- trace so it does not go unnoticed either.
    begin
      insert into private.push_failures (message_id, reason) values (new.id, sqlerrm);
    exception
      when others then null;
    end;
    return new;
end $$;

drop trigger if exists messages_push on public.messages;
create trigger messages_push
  after insert on public.messages
  for each row
  execute function public.on_message_push();

-- ===========================================================================
-- LAST STEP — point the trigger at your deployed function.
--
-- Replace <PROJECT-REF> with your project ref, and pick any long random
-- string as the secret. The same secret goes into the function's
-- PUSH_SECRET setting, and the two must match or the function refuses the
-- request.
--
-- Uncomment and run:
-- ===========================================================================
-- insert into private.push_config (id, endpoint, secret)
-- values (
--   1,
--   'https://<PROJECT-REF>.supabase.co/functions/v1/push',
--   'replace-with-a-long-random-string'
-- )
-- on conflict (id) do update
--   set endpoint = excluded.endpoint,
--       secret   = excluded.secret;
