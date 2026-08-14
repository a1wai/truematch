-- ===========================================================================
-- True Match — is the database actually set up?
--
-- Paste the whole file into the Supabase SQL editor and press Run.
--
-- It answers the only question that matters: what state is the database in
-- right now. It does not matter how many saved queries you have in the
-- editor or which order you ran them in — saved queries are just text, and
-- the database has exactly one state.
--
-- Everything below is read-only apart from the schema reload on line 1.
--
-- Read the "status" column. Any MISSING means run supabase/setup.sql again.
-- ===========================================================================

-- PostgREST caches the schema. Without this, a table you just created can
-- still 404 for the app.
notify pgrst, 'reload schema';

-- One query, one result grid. The Supabase editor only shows results from
-- the last statement, so a file full of separate SELECTs would hide all but
-- one of its own answers.
with checks as (
  select 1 as ord, 'table: profiles' as check_name,
         to_regclass('public.profiles') is not null as ok, '' as detail
  union all
  select 2, 'table: conversations',
         to_regclass('public.conversations') is not null, ''
  union all
  select 3, 'table: conversation_members',
         to_regclass('public.conversation_members') is not null, ''
  union all
  select 4, 'table: messages',
         to_regclass('public.messages') is not null, ''
  union all
  -- Catches the old room-based messages table surviving underneath.
  select 5, 'messages has conversation_id',
         exists (
           select 1 from information_schema.columns
           where table_schema = 'public' and table_name = 'messages'
             and column_name = 'conversation_id'
         ),
         'if MISSING you are still on the old schema'
  union all
  select 6, 'function: create_account',
         exists (
           select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
           where n.nspname = 'public' and p.proname = 'create_account'
         ),
         'sign-up needs this'
  union all
  select 7, 'function: start_direct_conversation',
         exists (
           select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
           where n.nspname = 'public' and p.proname = 'start_direct_conversation'
         ),
         'adding a user needs this'
  union all
  select 8, 'function: is_member',
         exists (
           select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
           where n.nspname = 'public' and p.proname = 'is_member'
         ), ''
  union all
  select 9, 'realtime: messages published',
         exists (
           select 1 from pg_publication_tables
           where pubname = 'supabase_realtime'
             and schemaname = 'public' and tablename = 'messages'
         ),
         'live messages need this'
  union all
  select 10, 'realtime: conversation_members published',
         exists (
           select 1 from pg_publication_tables
           where pubname = 'supabase_realtime'
             and schemaname = 'public' and tablename = 'conversation_members'
         ),
         'new chats appearing live need this'
  union all
  select 11, 'row level security on all four tables',
         (
           select count(*) = 4 from pg_class c join pg_namespace n on n.oid = c.relnamespace
           where n.nspname = 'public' and c.relrowsecurity
             and c.relname in ('profiles', 'conversations', 'conversation_members', 'messages')
         ), ''
  union all
  select 12, 'policies exist',
         (select count(*) from pg_policies where schemaname = 'public') >= 8,
         (select count(*)::text || ' policies' from pg_policies where schemaname = 'public')
)
select check_name, status, detail from (
  select ord, check_name,
         case when ok then 'OK' else 'MISSING' end as status,
         detail
  from checks

  union all

  -- Counting profiles has to be done indirectly. A plain
  -- "select count(*) from public.profiles" is resolved when the statement
  -- is parsed, so on a database where setup.sql has never run the whole
  -- file dies with "relation does not exist" — precisely the situation you
  -- would be running this in. query_to_xml defers it to runtime, where the
  -- CASE can skip it.
  select 99, 'accounts registered',
    case when to_regclass('public.profiles') is null then '-'
    else (xpath('/row/c/text()', query_to_xml(
      'select count(*) as c from public.profiles', false, true, '')))[1]::text
    end,
    case when to_regclass('public.profiles') is null then 'no profiles table yet'
    else coalesce((xpath('/row/u/text()', query_to_xml(
      'select string_agg(username, '', '' order by username) as u from public.profiles',
      false, true, '')))[1]::text, '(none)')
    end
) rows
order by ord;
