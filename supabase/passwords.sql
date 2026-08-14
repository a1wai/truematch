-- ===========================================================================
-- True Match — account lookup and password admin
--
-- Run these in the Supabase dashboard: SQL Editor -> New query -> paste one
-- block -> Run. Do them one block at a time, not all at once.
--
-- READ THIS FIRST
-- Passwords are NOT stored. auth.users.encrypted_password holds a bcrypt
-- hash, which is one-way on purpose: there is no query, no dashboard page,
-- and no support ticket that turns it back into the password the person
-- typed. Anyone claiming otherwise is wrong.
--
-- So there are only two useful things to do:
--   * CHECK a password someone has given you (block 3)
--   * SET a new one for them (block 4)
--
-- A username maps to the login address <username>@truematch.app. The app
-- never shows that address; it exists because GoTrue wants an email.
-- ===========================================================================


-- ---------------------------------------------------------------------------
-- 1. List every account
-- ---------------------------------------------------------------------------
select
  p.username,
  p.id,
  (p.avatar is not null)              as has_picture,
  u.email                             as login_address,
  u.created_at                        as signed_up,
  u.last_sign_in_at                   as last_login,
  (u.encrypted_password is not null)  as has_password
from public.profiles p
join auth.users u on u.id = p.id
order by u.created_at desc;


-- ---------------------------------------------------------------------------
-- 2. Look up one person by username
--    Replace 'theusername' with the username you are looking for.
-- ---------------------------------------------------------------------------
select
  p.username,
  p.id,
  u.email        as login_address,
  u.created_at   as signed_up,
  u.last_sign_in_at,
  -- The hash itself. Shown only so you can see it IS a hash ($2a$10$...),
  -- never something you can read the password out of.
  left(u.encrypted_password, 12) || '…' as password_hash_preview
from public.profiles p
join auth.users u on u.id = p.id
where lower(p.username) = lower('theusername');


-- ---------------------------------------------------------------------------
-- 3. CHECK a password without changing it
--
--    This is the closest thing to "checking someone's password": you supply
--    a guess, and Postgres re-hashes it with the same salt and compares. It
--    answers yes/no. It cannot enumerate or reveal anything.
--
--    Useful when someone says "my password isn't working" — this tells you
--    whether the password is wrong or something else is.
--
--    Replace both 'theusername' and 'their-password-guess'.
-- ---------------------------------------------------------------------------
select
  p.username,
  (u.encrypted_password = extensions.crypt('their-password-guess', u.encrypted_password))
    as password_is_correct
from public.profiles p
join auth.users u on u.id = p.id
where lower(p.username) = lower('theusername');


-- ---------------------------------------------------------------------------
-- 4. SET a new password (the "contact team" recovery path)
--
--    The app has no forgot-password flow by design, so this is how you get
--    someone back in. Set it, tell them what it is, tell them to change it.
--
--    Replace 'theusername' and 'new-password-here'. Minimum 6 characters, to match
--    what the signup form enforces.
-- ---------------------------------------------------------------------------
update auth.users u
set
  encrypted_password = extensions.crypt('new-password-here', extensions.gen_salt('bf')),
  updated_at         = now()
from public.profiles p
where p.id = u.id
  and lower(p.username) = lower('theusername');

-- Then confirm it took — this should come back true:
select
  p.username,
  (u.encrypted_password = extensions.crypt('new-password-here', u.encrypted_password))
    as new_password_works
from public.profiles p
join auth.users u on u.id = p.id
where lower(p.username) = lower('theusername');


-- ---------------------------------------------------------------------------
-- 5. Delete an account entirely
--    Removes the login, the profile, and everything cascading off it.
--    There is no undo.
-- ---------------------------------------------------------------------------
-- delete from auth.users u
-- using public.profiles p
-- where p.id = u.id and lower(p.username) = lower('theusername');
