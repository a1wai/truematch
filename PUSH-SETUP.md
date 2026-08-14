# Turning on notifications when the app is closed

Everything in the app is already built for this. What is missing is a Firebase
project, and that has to be created under your own Google account — nobody
else can do it for you.

Until you finish this, nothing breaks. The app keeps working exactly as it
does now: notifications arrive while it is open or in the background, and not
when it has been swiped away.

Budget about 20 minutes. There are four parts, in order:

1. Firebase — 5 minutes
2. GitHub — 2 minutes
3. Supabase database — 3 minutes
4. Supabase function — 10 minutes

---

## Why this is needed at all

The notifications you have now are raised by the app about itself. A closed
app cannot do that, because it is not running. Nothing on a phone lets a dead
process wake itself up.

WhatsApp does not keep itself running either. Android keeps **one** connection
open for the whole device, run by Google, called Firebase Cloud Messaging. Apps
hand their message to Google, and Google delivers it — starting the app if it
has to. That connection is the only way to reach a closed app, so that is what
we use.

---

## Part 1 — Firebase

### 1.1 Create the project

1. Go to **https://console.firebase.google.com** and sign in.
2. Click **Create a project**.
3. Name it `True Match` (the name is only for you).
4. Google Analytics is not needed. Turn it off.
5. Click **Create project**, wait, then **Continue**.

### 1.2 Add the Android app

1. On the project home page, click the **Android** icon (the little robot).
2. **Android package name** — this must match exactly, character for
   character. Copy and paste it:

   ```
   app.truematch.duo
   ```

   Getting this wrong is the single most common mistake, and the symptom is
   that nothing arrives with no error anywhere.
3. Nickname: `True Match`. Leave the SHA-1 field empty — it is not needed for
   messaging.
4. Click **Register app**.

### 1.3 Download the config file

1. Click **Download google-services.json**.
2. Keep it. You need its *contents* in Part 2.
3. Click **Next** through the SDK instructions and **Continue to console** —
   those steps are already done in this project.

### 1.4 Get the server key

This is what lets the Supabase function send on your behalf. It is a real
secret — anyone holding it can send notifications as your app.

1. Click the **gear** next to *Project Overview* → **Project settings**.
2. Open the **Service accounts** tab.
3. Click **Generate new private key**, then **Generate key**.
4. A `.json` file downloads. Keep it for Part 4.

You now have two files. They are not interchangeable:

| File | Which one | Goes where |
| --- | --- | --- |
| `google-services.json` | downloaded in 1.3, mentions `app.truematch.duo` | GitHub, into the APK |
| `truematch-xxxx-….json` | downloaded in 1.4, has `"private_key"` | Supabase, stays server-side |

---

## Part 2 — GitHub

The APK is built by GitHub Actions, so the config file has to reach the build.

1. Open **https://github.com/a1wai/truematch/settings/secrets/actions**
2. Click **New repository secret**.
3. Name: `GOOGLE_SERVICES_JSON`
4. Secret: open `google-services.json` in a text editor, select all, copy, and
   paste the **whole file** including the outermost `{` and `}`.
5. Click **Add secret**.

That is the linking step. From now on every APK build picks it up
automatically; without it the build still succeeds and push is simply inert.

---

## Part 3 — Supabase database

In the Supabase dashboard, **SQL Editor → New query**.

1. Paste all of `supabase/push.sql` and press **Run**. This adds the table that
   remembers which phones to send to, and the trigger that asks for delivery.

2. Now point the trigger at your function. Run this, replacing the two values:

   ```sql
   insert into private.push_config (id, endpoint, secret)
   values (
     1,
     'https://yxacrugblyriruuidoiy.supabase.co/functions/v1/push',
     'PICK-A-LONG-RANDOM-STRING'
   )
   on conflict (id) do update
     set endpoint = excluded.endpoint,
         secret   = excluded.secret;
   ```

   The URL above already has your project ref in it. For the secret, invent a
   long random string — 30+ characters, any mix. Write it down; Part 4 needs
   the identical value.

---

## Part 4 — The function

The function is in `supabase/functions/push/index.ts`. It needs to run on
Supabase's servers. Two ways, pick one.

### Option A — the dashboard, no installs

1. Supabase dashboard → **Edge Functions** → **Deploy a new function** →
   **Via editor**.
2. Name it exactly `push`.
3. Delete the sample code, then paste the entire contents of
   `supabase/functions/push/index.ts`.
4. Deploy it.
5. Open the function's **Details → Settings** and turn **Verify JWT** *off*.
   The caller is your database, not a signed-in person, so it authenticates
   with the secret from Part 3 instead.
6. Go to **Edge Functions → Secrets** and add two:

   | Name | Value |
   | --- | --- |
   | `PUSH_SECRET` | the same long random string from Part 3 |
   | `FCM_SERVICE_ACCOUNT` | the entire contents of the service-account JSON from 1.4 |

### Option B — the CLI

```bash
npm install -g supabase
supabase login
supabase link --project-ref yxacrugblyriruuidoiy

supabase secrets set PUSH_SECRET='the-same-long-random-string'
supabase secrets set FCM_SERVICE_ACCOUNT="$(cat ~/Downloads/truematch-xxxx.json)"

supabase functions deploy push --no-verify-jwt
```

---

## Finishing up

1. Push any commit, or re-run the **Build Android APK** workflow by hand, so a
   new APK is built with the Firebase config in it.
2. Install that APK on both phones.
3. **Sign out and back in on each phone.** This is what registers the device.
   Without it there is nothing to send to.

### Check it worked

In the SQL editor:

```sql
select user_id, platform, updated_at from public.device_tokens;
```

One row per signed-in phone. If it is empty, the phones have not registered —
recheck the package name in 1.2 and that you reinstalled after Part 2.

Then close True Match completely on one phone (swipe it away), and message
that account from the other. The notification should arrive within a second or
two.

---

## If nothing arrives

Work through these in order; the first one that shows something is your answer.

**Did the database ask for delivery?**

```sql
select * from private.push_failures order by at desc limit 20;
```

Empty is good — it means the request went out. If there are rows, the message
tells you what went wrong.

**Is anything registered to send to?**

```sql
select count(*) from public.device_tokens;
```

Zero means the phone never registered. Almost always the package name in
Firebase does not match `app.truematch.duo`, or the APK was built before the
GitHub secret was added.

**Did the function run, and what did it say?**

Supabase dashboard → **Edge Functions → push → Logs**. What you might see:

| In the logs | What it means |
| --- | --- |
| `401 unauthorized` | `PUSH_SECRET` and `private.push_config.secret` are not the same string |
| `FCM_SERVICE_ACCOUNT is not set` | the secret is missing, or you pasted the wrong JSON file |
| `google oauth 400` | the service-account JSON is malformed — re-paste it whole |
| `{"sent":0,"reason":"no devices registered"}` | back to the `device_tokens` check |
| `{"sent":1}` | it worked; if the phone still shows nothing, check Android's notification settings for True Match |
| nothing at all | the trigger never called it — recheck the endpoint URL in Part 3 |

**Notifications work with the app open but not when closed?** That is the
local path working and push not. Everything above still applies.
