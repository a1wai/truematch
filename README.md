# True Match

A two-person, WhatsApp-style messenger with a hidden **Lie & Deception Detector**. The chat is
ordinary; the interesting part is the scanner behind the 🕵️‍♂️ button, which reads the thread and
reports where the other person's language stops being consistent.

Built with **Vite + React + Tailwind CSS v4 + Lucide + Framer Motion**. No backend, no accounts —
everything lives in `localStorage`.

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # -> dist/
npm run preview
```

## What is in the prototype

**Authentication & perspective switching.** A login screen with pre-populated *Login as User 1* /
*Login as User 2* buttons, and a persistent top bar reading *Currently viewing as: …* with a switch
control. Both sides of the conversation live on one device, so you can play Alex, answer as Jordan,
and scan in either direction. The scan always analyses whoever you are **not** logged in as.

**The chat.** WhatsApp dark-emerald styling (`#00a884` on `#0b141a`), day separators, delivery and
read receipts (✓ / ✓✓ / blue ✓✓), typing indicators, image, voice-note and document attachment
previews, and a responsive two-pane layout that collapses to a single pane on mobile.

**Deception Intelligence Report.** Triggered by the glowing scan button in the chat header:

- **Dishonesty risk meter** — animated SVG ring that counts up and colours by band.
- **Timeframe selector** — Last 24 Hours / Last 7 Days / All Chat History, re-running the scan.
- **Linguistic anomaly breakdown** — four detector families, each with a signal-strength bar,
  clickable to filter the feed below.
- **Flagged messages feed** — every finding quotes the exact message, highlights the substring that
  triggered it, explains *why* in plain English, and links back to the older message it contradicts.
- **Tactical counter-strategy** — copilot suggestions with the exact line to send, the reasoning
  behind it, and a *Load into composer* button.

Reports export as JSON and are kept (12 most recent) in `localStorage`.

## How the detector works

`src/lib/analysis.js` is a deterministic, fully offline engine — no model required. Every flag
carries the substring that produced it, so nothing is a black box.

| Detector | What it looks for |
| --- | --- |
| 🚩 Over-explaining | Word count, density of justification markers (*because*, *the reason*, *anyway*, *honestly*), unprompted specifics, and long answers to short questions. |
| 🚩 Distancing language | A named referent ("my friend Sam") later reduced to "that person" / "someone from work", or a referent relabelled between messages. |
| 🚩 Timeline contradictions | Location and departure-time claims are extracted per message, grouped by the **day they describe** (weekday names resolve to real dates), and compared. Only genuinely exclusive pairs conflict — "office" then "home" is a sequence, not a lie. Negations ("*not* the gym") are excluded. |
| 🚩 Deflection & manipulation | Gaslighting and thread-termination phrasing ("you're overthinking", "you're remembering it wrong", "can we drop this"), plus reply latency after a direct question. |

Each flag is weighted by severity and mapped through `1 - e^(-total/k)` to a 0–100 risk score, so
signals accumulate with diminishing returns rather than saturating at the first hit. Contradictions
are computed over the whole history and then filtered so the *newer* statement falls inside the
selected timeframe — that is what makes "Last 24 Hours" surface a fresh claim that conflicts with a
week-old one.

The seeded conversation contains planted cues on **both** sides, so switching perspective produces a
genuinely different report (~86% one way, ~33% the other).

## Optional: live open-source models

The gear icon opens client-side AI settings. Pick **Groq**, **OpenRouter**, or any OpenAI-compatible
**custom endpoint** (Ollama, vLLM, LM Studio), paste a free key, and choose a model —
`llama-3.3-70b-versatile`, `qwen/qwen-2.5-72b-instruct`, `deepseek-r1` and friends. With *Use live
model for scans* enabled, the transcript is sent to that provider and its findings are merged with
the local ones; if the request fails, the report falls back to the on-device analysis and says so.

Keys are stored in `localStorage` and sent straight from the browser to the provider — fine for a
prototype on your own machine, not for a shared computer or a production key.

## Deployment

`vite.config.js` sets `base: './'`, so `dist/` works unchanged from a subpath or a domain root.

- **GitHub Pages** — `.github/workflows/deploy.yml` builds and publishes on every push to `main`
  (enable Pages → Source: GitHub Actions).
- **Vercel** — `vercel.json` is included; import the repo and accept the defaults.

## A note on what this is

Linguistic deception cues are weak, contested signals. Stress, culture, neurodivergence and typing
habits all produce the same patterns this engine flags. The report says so in its own footer, and
the counter-strategy section suggests questions rather than conclusions. Treat the output as a
prompt for a conversation — never as evidence about a person.
