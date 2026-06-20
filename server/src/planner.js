import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import 'dotenv/config';

const __dirname = dirname(fileURLToPath(import.meta.url));
const roadmap = JSON.parse(readFileSync(join(__dirname, 'data', 'roadmap.json'), 'utf-8'));
const bank = JSON.parse(readFileSync(join(__dirname, 'data', 'taskBank.json'), 'utf-8'));

const START = process.env.PLAN_START_DATE || '2026-06-17';
const TZ = process.env.TIMEZONE || 'Asia/Kolkata';
export const planStartDate = START;

// --- date helpers (date-only, no time zone math beyond the day) ---
export function todayDate() {
  // Calendar date in the configured timezone. en-CA formats as YYYY-MM-DD.
  // This keeps "today" correct for late-night use (UTC would roll over early).
  return new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(new Date());
}

export function dayIndexFor(dateStr) {
  const start = new Date(START + 'T00:00:00');
  const d = new Date(dateStr + 'T00:00:00');
  const diff = Math.floor((d - start) / 86400000);
  return diff + 1; // day 1 == start date
}

function weekdayTopics(dateStr) {
  const wd = new Date(dateStr + 'T00:00:00').getDay(); // 0 Sun .. 6 Sat
  return roadmap.weekdayFocus[String(wd)] || roadmap.weekdayFocus['1'];
}

function phaseForDay(dayIndex) {
  return roadmap.phases.find(p => dayIndex >= p.startDay && dayIndex <= p.endDay) || null;
}

// Deterministic pick so the same day always yields the same task,
// but well-spread across consecutive days (Knuth multiplicative hash).
function pick(arr, seed) {
  if (!arr || arr.length === 0) return null;
  const h = (Math.imul(seed >>> 0, 2654435761) >>> 0);
  return arr[h % arr.length];
}

function firstTopicWithKind(topics, kind, seed) {
  for (const t of topics) {
    const pool = bank[t] && bank[t][kind];
    if (pool && pool.length) {
      const item = pick(pool, seed);
      return { topic: t, ...item, kind };
    }
  }
  return null;
}

// Build the 3 tasks (code/learn/speak) for a generated day (>=15).
function generateTasks(dayIndex, dateStr) {
  const phase = phaseForDay(dayIndex);
  const wd = weekdayTopics(dateStr);
  const seed = dayIndex;

  // Topic priority: weekday focus first, then phase topics, then sensible fallbacks.
  const codeTopics  = [...wd.topics, ...(phase ? phase.topics : []), 'csharp', 'sql', 'dotnet', 'dsa'];
  const learnTopics = [...wd.topics, ...(phase ? phase.topics : []), 'dotnet', 'sql', 'csharp'];

  const code  = firstTopicWithKind(codeTopics, 'code', seed)
             || firstTopicWithKind(codeTopics, 'speak', seed); // review/mock days may only have speak
  const learn = firstTopicWithKind(learnTopics, 'learn', seed + 1);
  const speakPool = bank.speaking.speak || [];
  const speak = speakPool.length ? speakPool[dayIndex % speakPool.length] : null; // clean rotation

  const tasks = [];
  if (code)  tasks.push({ kind: code.kind || 'code', title: code.title, detail: code.detail, resource_url: code.resource || '', minutes: code.minutes || 35 });
  if (learn) tasks.push({ kind: 'learn', title: learn.title, detail: learn.detail, resource_url: learn.resource || '', minutes: learn.minutes || 30 });
  if (speak) tasks.push({ kind: 'speak', title: speak.title, detail: speak.detail, resource_url: '', minutes: speak.minutes || 15 });
  return tasks;
}

// Public: full plan for a date — labels + tasks. status/mode come from DB elsewhere.
export function planForDate(dateStr) {
  const dayIndex = dayIndexFor(dateStr);

  if (dayIndex < 1) {
    return { dayIndex, beforeStart: true, weekLabel: 'Plan not started yet', phase: '', focus: 'Your plan begins on ' + START, tasks: [] };
  }

  // Explicit rehabilitation days 1-14
  const explicit = roadmap.explicitDays.find(d => d.day === dayIndex);
  if (explicit) {
    return {
      dayIndex,
      weekLabel: dayIndex <= 7 ? 'Week 1 — Programming restart' : 'Week 2 — Basics, SQL & first mock',
      phase: explicit.title,
      focus: 'Rehabilitation day. Restart the machine, do not judge yourself.',
      defaultMode: explicit.defaultMode || 'normal',
      tasks: explicit.tasks.map(t => ({ kind: t.kind, title: t.title, detail: t.detail, resource_url: t.resource || '', minutes: t.minutes }))
    };
  }

  // Generated days 15..90
  const phase = phaseForDay(dayIndex);
  const wd = weekdayTopics(dateStr);
  return {
    dayIndex,
    weekLabel: phase ? `Week ${phase.week} — ${phase.name}` : 'Beyond the 90-day plan',
    phase: phase ? phase.name : 'Maintenance',
    focus: phase ? `${phase.focus} (Today: ${wd.name}.)` : 'Keep your reps and applications going.',
    defaultMode: 'normal',
    tasks: generateTasks(dayIndex, dateStr)
  };
}

export const roadmapMeta = roadmap.meta;
export const consistencyRules = roadmap.consistencyRules;
export const modes = roadmap.modes;
export const phases = roadmap.phases;
