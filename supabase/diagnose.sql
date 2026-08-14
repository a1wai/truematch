-- 1. Force the API layer to pick up the new tables
notify pgrst, 'reload schema';

-- 2. Show what the app should be able to see
select table_name
from information_schema.tables
where table_schema = 'public'
order by table_name;

-- 3. Confirm RLS is on and policies exist
select tablename, count(*) as policies
from pg_policies
where schemaname = 'public'
group by tablename
order by tablename;
