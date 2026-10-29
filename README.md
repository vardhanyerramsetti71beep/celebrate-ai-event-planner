# 🎉 Celebrate — AI Event Planner

A GenAI-powered planning assistant for **weddings, birthdays, community and corporate events**, built for **PromptWars Challenge 05: Celebration & Event Planner**.

Enter your event type, date, guest count, budget, city and theme. **Google Gemini** builds a complete plan that you can track:

| Feature | What it does |
|---|---|
| 💰 **Budget** | Category-wise split that always adds up to your total, cost per guest, and "spent vs. left" tracking with overspend warnings |
| 🗓️ **Timeline** | 12–18 tasks with real due dates counted back from your event date, overdue flags and progress |
| 📋 **Vendor checklist** | Which vendors to book, by when, estimated cost, and the questions to ask each one |
| 💡 **Personalised ideas** | Creative ideas matched to your theme, culture and city, plus money-saving tips |
| ⏰ **Event-day run sheet** | Hour-by-hour schedule for the day |
| 🤖 **Ask the planner** | Change the plan in plain words ("cut decor by half", "add a sangeet night") and Gemini rewrites it |
| 💾 **Saved plans** | Several plans are saved in your browser; print or save as PDF |

## How it works

```
Browser (index.html, main.js)  →  POST /api/plan  →  Google Gemini (gemini-3.8-flash, JSON mode)
                                      │
                         lib/plan-core.js: validates input, builds the prompt,
                         cleans the AI output (budget forced to the exact total,
                         dates capped to the time available)
```

- **Prompt design:** structured prompt with a strict JSON shape, rules for budget totals, task counts and date limits. User text is marked as data so it can't override the rules (prompt-injection guard).
- **Reliability:** if Gemini is down or the key is missing, the app shows a sample plan from built-in templates (`lib/fallback.js`) so the user never gets an empty screen.
- **Security:** the API key stays on the server, input is length-limited and cleaned, all output is HTML-escaped, and strict security headers (CSP etc.) are set in `vercel.json`.
- **Accessibility:** labelled form fields, keyboard-navigable tabs (arrow keys), skip link, live status messages, dark mode and reduced-motion support.
- **No dependencies:** plain HTML/CSS/JS + one serverless function. The repo is tiny.

## Run locally

Requires Node.js 20+.

```bash
cp .env.example .env      # then paste your key from https://aistudio.google.com/app/apikey
npm start                 # http://localhost:3000
npm test                  # 9 unit tests
```

## Deploy to Vercel

1. Push this folder to a **public** GitHub repo.
2. On [vercel.com/new](https://vercel.com/new), import the repo (no build settings needed).
3. Add the environment variable `GEMINI_API_KEY` (and optionally `GEMINI_MODEL`).
4. Deploy. Your live URL is `https://<project>.vercel.app`.

## Project structure

```
index.html, styles.css, main.js  Front end
api/plan.js                      Serverless function that calls Gemini
lib/plan-core.js                 Input checks, prompts, output cleaning (shared)
lib/fallback.js                  Template plans when AI is unavailable
dev-server.js                    Local dev server (not used on Vercel)
tests/plan.test.js               Unit tests (node --test)
```
