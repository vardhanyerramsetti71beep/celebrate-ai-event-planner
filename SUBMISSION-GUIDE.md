# Submission guide (deadline: Nov 1, 2026, 11:59 PM IST)

## 1. Get a Gemini key (2 min)
https://aistudio.google.com/app/apikey → Create API key. Put it in `.env` as `GEMINI_API_KEY=...` to test locally (`npm start`).

## 2. Push to GitHub (5 min)
```bash
git init
git add .
git commit -m "Celebrate: AI event planner for PromptWars Challenge 05"
git branch -M main
git remote add origin https://github.com/<your-username>/celebrate-ai-event-planner.git
git push -u origin main
```
Make the repo **public**. `.env` is git-ignored, so your key is not uploaded. The repo is well under 10 MB.

## 3. Deploy on Vercel (5 min)
vercel.com/new → Import the repo → Settings → Environment Variables → add `GEMINI_API_KEY` → Deploy.
Open the live URL and generate one plan to check the AI works (no yellow "sample plan" note).

## 4. Demo video (under 4 min)

| Time | Show |
|---|---|
| 0:00–0:20 | The problem: planning events means juggling budgets, deadlines and vendors. Celebrate does it with Gemini. |
| 0:20–1:00 | Fill the form: Wedding, date, 150 guests, ₹10,00,000, Hyderabad, "Pastel garden, traditional Telugu". Click Generate. |
| 1:00–1:40 | **Budget** tab: split adds up exactly; type a spent amount and show "left" update. |
| 1:40–2:10 | **Timeline**: real dates, tick a task, progress stat updates. |
| 2:10–2:40 | **Vendors**: book-by dates and questions to ask. Tick one as booked. |
| 2:40–3:00 | **Ideas** and **Event day** tabs. |
| 3:00–3:30 | **Ask the planner**: "Cut decor by half and add a sangeet night" → plan updates. |
| 3:30–3:50 | Switch to a saved birthday plan; Print / PDF. Mention the fallback, security and tests. |

Record with OBS, Loom or the Windows Snipping Tool (screen recording). Upload to YouTube as Unlisted or to Google Drive with link sharing on.

## 5. Submit
Live URL + GitHub URL + video link on the PromptWars submission dashboard.
