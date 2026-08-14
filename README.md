# True Match

[![Build Android APK](https://github.com/a1wai/truematch/actions/workflows/build-apk.yml/badge.svg)](https://github.com/a1wai/truematch/actions/workflows/build-apk.yml)
[![Download APK](https://img.shields.io/badge/Download-Android%20APK-FF2E63?style=for-the-badge&logo=android&logoColor=white)](https://github.com/a1wai/truematch/releases/latest/download/truematch.apk)

**[⬇️ Download the latest Android APK](https://github.com/a1wai/truematch/releases/latest/download/truematch.apk)**

A private messenger with a lie & deception detector running quietly underneath. The chat is ordinary. The interesting part is the 🕵️‍♂️ button,
which reads the thread — in English *or* romanised Urdu, Hindi, Indonesian,
Turkish or Romanian — and reports where the other person's story stops holding
together.

Web + Android, built with **Vite · React · Tailwind v4 · Supabase Realtime ·
Capacitor · Framer Motion · Lucide**.

```bash
npm install
npm run dev          # http://localhost:5173
npm run build        # -> dist/
npm run android:apk  # -> android/app/build/outputs/apk/debug/app-debug.apk
```

---

## Accounts

Sign up with a **username and a password**. No email, no phone number, no demo
accounts. Usernames are unique and case-insensitive, and they are the only way
to find anyone.

**There is no password recovery.** No reset link, no security questions. If
someone forgets their password, an admin has to reset it from the Supabase
dashboard. The sign-up screen says this before you commit to a password.

Every new account picks a profile picture before it can start chatting. The
image is downscaled in the browser and stored on the profile row, so it follows
the account onto any device.

## Setting up the backend

1. Create a free project at [supabase.com](https://supabase.com).
2. **SQL Editor** → run [`supabase/schema.sql`](supabase/schema.sql).
3. **Authentication → Sign In / Providers → Email** → turn **Confirm email**
   **off**. Accounts have no real inbox, so leaving it on makes every login fail.
4. Put the project URL and **anon public** key into `src/lib/cloud-config.js`,
   or set `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` as repo secrets, or
   paste them into **Settings → Realtime sync** in the app. Settings wins, then
   env, then the baked-in defaults.

Everything lives in that project: accounts, profiles, conversations, messages
and attached photos. The only things kept on the device are app preferences,
saved scan reports and the private AI-friend thread.

### How usernames turn into logins

Supabase Auth requires an email, so the app derives a synthetic one
(`<username>@truematch.app`) that is never shown. Password hashing, sessions and
refresh tokens stay inside Supabase rather than being hand-rolled.

### Security model, stated plainly

Row-level security restricts every message to members of that conversation,
enforced by Postgres rather than by the client — the anon key alone gets a
stranger nothing without a valid login. Profiles (username and picture) are
public by design, because that is what makes "add someone by username" work.
The one loose end is documented at the bottom of `schema.sql`: any signed-in
account can join a conversation if it can guess a UUID.

## Romanised language support

People do not text in clean English or clean Urdu. They text like this:

> *"main office mein tha, 11 baje tak, waise bhi tumhe ghalat yaad hai"*

Both engines understand that.

**On-device (no key needed).** The rule engine in `src/lib/analysis.js` carries
pattern banks for English and Roman Urdu/Hindi across all four detector
families, plus deflection phrases for Indonesian, Turkish and Romanian. It reads
`11 baje tak` as a time claim, treats `ghar pe nahi thi` as a *negated* claim
rather than a location, and knows that `koi baat nahi` is "no problem" while
`office ka koi tha` is an anonymised person.

**With a model (Groq / OpenRouter / any OpenAI-compatible endpoint).** The system
prompt normalises first and judges second: every message is translated to
English internally *before* any deception analysis runs, and the prompt states
outright that spelling, typos and script choice are never evidence — so
`nahi`/`nahin`/`nai` drift can't be mistaken for evasion. Findings come back
with the original quote, an English translation, and the explanation in both
English and the reader's own language.

Pick the report language in the report header or in Settings. `Auto-detect`
fingerprints the conversation by stop-word frequency; anything else forces that
language.

## The report

- **Risk meter** — animated ring, 0–100, coloured by band.
- **Timeframe** — Last 24 Hours / Last 7 Days / All Chat History.
- **Four detector families**, each with a signal-strength bar that filters the
  feed below it.
- **Flagged messages** — every finding quotes the exact message, highlights the
  substring that triggered it, explains why in plain language, and links back to
  the older message it contradicts.
- **Counter-strategy** — suggested questions, written in the language you both
  actually text in, with a *Load into composer* button.
- **Simplify this report** — one verdict line, three findings, one next step, in
  the selected language. Works offline; a configured model rewrites it better.

Reports export as JSON and the last 12 are kept on the device.

## Notifications

New messages raise a notification the moment the row arrives over the realtime
socket — no polling, no server round trip beyond the message itself. Tapping one
opens that conversation. Nothing fires for your own messages, or for a thread
you already have open.

These are Capacitor local notifications, so they need the app process to be
alive: foreground and backgrounded both work, fully swiped-away does not.
Delivery to a killed app needs Firebase Cloud Messaging and a server to push
from, which is a separate piece of work.

### How the detector works

Deterministic and explainable — every flag carries the substring that produced
it. No black box.

| Detector | What it looks for |
| --- | --- |
| 🚩 Over-explaining | Word count, density of justification markers (*because*, *kyunki*, *is liye*, *waise bhi*, *karena*, *çünkü*), unprompted specifics, long answers to short questions. |
| 🚩 Distancing | A named referent (*"mera dost Kamran"*) later reduced to *"office ka koi"* / *"that person"*, or a referent relabelled between messages. |
| 🚩 Timeline | Location and departure-time claims extracted per message, grouped by **the day they describe** (weekday names resolve to real dates), then compared. Only genuinely exclusive pairs conflict — office→home is a sequence, not a lie. Negation is handled on both sides of the phrase, since Urdu and Turkish put it *after* (`ghar pe nahi thi`). |
| 🚩 Deflection | Gaslighting and thread-shutdown phrasing (*"you're overthinking"*, *"tum bohat zyada soch rahi ho"*, *"tumhe ghalat yaad hai"*, *"chhoro is baat ko"*), plus reply latency after a direct question. |

Signals are severity-weighted and mapped through `1 - e^(-total/k)`, so evidence
accumulates with diminishing returns instead of pinning at 95% on the first hit.
Contradictions are computed across all history and then filtered so the *newer*
statement falls inside the selected window — that is what lets "Last 24 Hours"
surface a fresh claim that conflicts with a week-old one.

The scan reads whatever real history exists in the open conversation, so it has
little to say until you have actually been talking for a while.

## Android APK

`.github/workflows/build-apk.yml` builds an APK on **every push to any branch**:

- Every push → downloadable artifact under the run's **Artifacts** section.
- Push to `main` → also refreshes the `latest` release, which is what the
  download button at the top of this file points at.

Locally, `npm run android:apk` does the same thing if you have the Android SDK
and JDK 21 installed. The native project is committed, so `android/` can be
opened directly in Android Studio.

The APK is a **debug build** signed with the standard Android debug key: fine
for installing on your own phones, not acceptable to the Play Store. For a
release build you would add a keystore, sign in the workflow, and switch to
`assembleRelease`.

## Deployment

`vite.config.js` sets `base: './'`, so one `dist/` works from a domain root, a
repo subpath, and the Capacitor `file://` shell.

- **Vercel** — `vercel.json` is included; import the repo and accept the defaults.
- **GitHub Pages** — `.github/workflows/deploy.yml` publishes on every push to
  `main`. Needs **Settings → Pages → Source: GitHub Actions** enabled once.

## Honest limits

- **Linguistic deception cues are weak signals.** Stress, culture,
  neurodivergence and typing habits all produce the same patterns this engine
  flags. The report says so in its own footer. Treat it as a prompt for a
  conversation, never as evidence about a person.
- **Report *content* is localised; the surrounding UI chrome is still English.**
  Category names, verdicts, gists and the simplified summary translate. Labels
  like "SCAN TIMEFRAME" do not.
- **Offline localisation is deliberately short.** Long-form per-flag reasoning in
  a non-English language comes from the model; without a key the detail stays in
  English rather than shipping shaky machine translation.
- **Roman Urdu and Roman Hindi are nearly identical once romanised.** Auto-detect
  guesses; override it in Settings if it picks wrong.
