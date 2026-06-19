# Mentor — your daily interview-prep coach

A single dashboard that hands you **3 tasks a day** (Code · Learn · Speak), lets you tick them off, paste what you learned for instant AI feedback, and hands you tomorrow. Your 90-day plan is the spine; AI only adapts it when you ask.

Built to be the opposite of 16 markdown files: **rich underneath, dead-simple to use daily.** The Today tab is the only screen you need most days.

---

## What's inside

- **Today** — the daily driver: 3 tasks, energy/mood, "Re-plan with AI", "paste what you learned" → feedback, close the day.
- **Roadmap** — your 90-day plan as readable phases.
- **Questions** — question bank with status tracking and your own answers.
- **Applications** — job tracker with status pipeline.
- **Speaking** — recording log (clarity/pace/confidence) + AI mock generator.
- **Progress** — streak, points, and a calm bar chart. The "chain" rewards *kept alive*, never punishes a miss.

All six tabs are functional and talk to a real backend. Nothing here is a mock.

---

## Architecture

```
  React (Vite)  ──fetch──▶  Express backend  ──▶  Supabase Postgres   (your real DB)
  one passcode             holds ALL secret      ──▶  Groq            (AI: re-plan, feedback, mock)
  header                   keys, never the       ──▶  Notion          (one-way sync: your reading layer)
                           frontend
```

- **Source of truth:** Supabase. **Notion:** synced reading/notes layer (optional).
- **AI:** Groq free tier, so you're never blocked when a subscription runs out. Plain `fetch`, no SDK.
- The 90-day plan lives in `server/src/data/roadmap.json` + `taskBank.json`. Days 1–14 are explicit; day 15+ is generated from phases + your weekday rhythm (Mon=C#, Tue=SQL, Wed=.NET, Thu=frontend, Fri=Azure/AI, Sat=deep work, Sun=review).

---

## Setup (about 15 minutes)

### 0. Prerequisites
- Node 18+ installed.

### 1. Supabase (the database)
1. Create a free project at supabase.com.
2. Open **SQL Editor → New query**, paste all of `server/db/schema.sql`, **Run**.
3. **Project Settings → API**: copy the **Project URL** and the **service_role** key.

### 2. Backend
```bash
cd server
npm install
cp .env.example .env
```
Edit `server/.env`:
- either `DATABASE_URL` (Supabase Postgres connection string) or `SUPABASE_URL` + `SUPABASE_SERVICE_KEY` (from step 1)
- `GROQ_API_KEY` - get a free key at console.groq.com -> API Keys
- `GROQ_MODEL` - pick a current chat model from console.groq.com/docs/models
- `APP_PASSCODE` - make up a private string (your light gate)
- `PLAN_START_DATE` - day 1 of your plan (default `2026-06-17`)

Run it:
```bash
npm run dev      # http://localhost:4000
```

### 3. Frontend
```bash
cd client
npm install
cp .env.example .env
```
Edit `client/.env`:
- `VITE_API_URL=http://127.0.0.1:4000`
- `VITE_APP_PASSCODE=` the same passcode you set in the backend

Run it:
```bash
npm run dev      # http://localhost:5173
```

Open http://localhost:5173. You should see today's 3 tasks.

### 4. Notion sync (optional)
Two ways:
- **Auto-create the databases:** in `notion.so/my-integrations` create an integration, copy its token into `NOTION_TOKEN`. Create one Notion page, share it with the integration, put its 32-char id in `NOTION_PARENT_PAGE_ID`, then:
  ```bash
  cd server && npm run setup-notion
  ```
  Paste the three printed IDs into `.env`.
- **Use existing databases:** just paste their IDs into `NOTION_DAILY_DB_ID`, `NOTION_QUESTIONS_DB_ID`, `NOTION_APPLICATIONS_DB_ID` (share each DB with your integration first).

Sync is one-way (app → Notion) and fires when you close a day / add a question / add an application. If Notion isn't configured, the app simply skips it.

---

## Deploy (free tier)

- **Backend → Railway** (or Render): deploy the `server` folder, add the same `.env` vars, set `CLIENT_ORIGIN` to your frontend URL.
- **Frontend → Vercel:** import the `client` folder, set `VITE_API_URL` to your Railway backend URL and `VITE_APP_PASSCODE`.

---

## The daily ritual (under 2 minutes)

1. Open **Today**.
2. Tap your **mode** (Full / Normal / Low) and your **energy**.
3. Low energy? Tap **Re-plan with AI** — it shrinks the day so you never take a zero.
4. Do the tasks, tick them off.
5. Paste anything you learned → get a quick check.
6. **Mark done** (or **Rest day** — no guilt). Your chain stays alive.

---

## Customizing the plan

- Edit `server/src/data/taskBank.json` to add/replace drills per topic.
- Edit `server/src/data/roadmap.json` to change the explicit first 14 days, the weekly phases, or the weekday focus.
- No code change needed — the planner reads these files.

---

## What's next (ideas, not required)
- Email/push the daily 3 tasks (you already run n8n).
- Two-way Notion sync if you'd rather edit in Notion.
- Add your partner as a second user (the schema is single-user today; add a `user_id` column + Supabase Auth when you want this).
