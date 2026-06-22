-- ============================================================
--  Interview Mentor — Supabase schema
--  Run this in Supabase: SQL Editor -> New query -> paste -> Run
--  Single-user app, so no RLS user scoping. The backend uses the
--  service role key and is the only thing that talks to these tables.
-- ============================================================

-- One row per calendar day you engage with the plan.
create table if not exists days (
  id            bigint generated always as identity primary key,
  day_index     int  not null,                 -- 1..90, your position in the plan
  the_date      date not null unique,           -- actual calendar date
  week_label    text,                           -- e.g. "Week 3 — .NET Core & Web API"
  phase         text,                           -- short phase name
  focus         text,                           -- one-line focus for the day
  mode          text not null default 'normal', -- full | normal | low
  status        text not null default 'pending',-- pending | done | rest | skipped
  was_replanned boolean not null default false,
  created_at    timestamptz not null default now()
);

-- The 3 (or adjusted) tasks for a given day.
create table if not exists tasks (
  id           bigint generated always as identity primary key,
  day_id       bigint not null references days(id) on delete cascade,
  kind         text not null,                   -- code | learn | speak
  title        text not null,
  detail       text,
  resource_url text,
  minutes      int,
  position     int not null default 0,
  done         boolean not null default false,
  done_at      timestamptz
);

-- Daily check-in (energy, mood, reflection).
create table if not exists logs (
  id                 bigint generated always as identity primary key,
  the_date           date not null unique,
  energy             int,                        -- 1..5
  mood               int,                        -- 1..5
  what_felt_hard     text,
  what_avoided       text,
  minutes_tomorrow   int,
  created_at         timestamptz not null default now()
);

-- "Paste what you learned" entries + AI feedback.
create table if not exists notes (
  id           bigint generated always as identity primary key,
  the_date     date not null default current_date,
  topic        text,
  content      text not null,
  ai_feedback  text,
  follow_up    text,
  restudy_flag boolean not null default false,
  created_at   timestamptz not null default now()
);

-- Interview question bank.
create table if not exists questions (
  id             bigint generated always as identity primary key,
  topic          text not null,                 -- C# | .NET | SQL | DSA | Azure | AI | React | Angular | Behavioral | Project
  difficulty     text not null default 'Easy',  -- Easy | Medium | Hard
  question       text not null,
  my_answer      text,
  status         text not null default 'New',   -- New | Learning | Can Answer | Mock Passed
  mistake        text,
  last_practiced date,
  created_at     timestamptz not null default now()
);

-- Job application tracker.
create table if not exists applications (
  id             bigint generated always as identity primary key,
  company        text not null,
  role           text,
  location       text,
  source         text,                          -- LinkedIn | Naukri | Instahyre | Referral | ...
  stack          text,
  status         text not null default 'Applied',-- Applied | Screen | Tech | Final | Offer | Rejected
  applied_date   date default current_date,
  recruiter      text,
  interview_date date,
  questions_asked text,
  result         text,
  created_at     timestamptz not null default now()
);

-- Speaking / recording tracker.
create table if not exists recordings (
  id          bigint generated always as identity primary key,
  the_date    date not null default current_date,
  prompt      text not null,
  duration_s  int,
  clarity     int,                              -- 1..5
  pace        int,                              -- 1..5
  confidence  int,                              -- 1..5
  transcript  text,
  one_fix     text,
  created_at  timestamptz not null default now()
);

alter table recordings add column if not exists transcript text;

-- ── 2026-06 additions ──────────────────────────────────────────────────────────
-- Run these in Supabase SQL Editor if upgrading an existing database.
alter table questions add column if not exists senior_answer  text;
alter table questions add column if not exists confidence     text;  -- '⚠️ Weak' | '🤔 Medium' | '💪 Strong'
alter table applications add column if not exists follow_up   text;  -- "next action" field, synced to Notion Follow-up

create index if not exists idx_tasks_day  on tasks(day_id);
create index if not exists idx_days_date  on days(the_date);
create index if not exists idx_notes_date on notes(the_date);

-- Seed a few starter questions so the Question Bank is not empty.
insert into questions (topic, difficulty, question) values
  ('C#',        'Easy',   'What is the difference between a value type and a reference type?'),
  ('C#',        'Medium', 'Why can calling .Result on an async task deadlock?'),
  ('.NET',      'Easy',   'What is dependency injection and what are the three lifetimes?'),
  ('.NET',      'Medium', 'Walk through the ASP.NET Core middleware pipeline for a request.'),
  ('SQL',       'Easy',   'INNER JOIN vs LEFT JOIN — when do rows drop?'),
  ('SQL',       'Medium', 'How would you investigate a slow stored procedure?'),
  ('DSA',       'Easy',   'Explain the two-pointer pattern with an example.'),
  ('Azure',     'Easy',   'Why use Azure App Service to host an API?'),
  ('AI',        'Medium', 'Azure OpenAI vs OpenAI — when and why?'),
  ('Behavioral','Easy',   'Tell me about yourself.'),
  ('Behavioral','Easy',   'Why are you looking for a change?'),
  ('Project',   'Medium', 'Explain the 40% SQL performance improvement in detail.')
on conflict do nothing;
