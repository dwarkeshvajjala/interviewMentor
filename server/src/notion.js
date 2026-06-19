import 'dotenv/config';

const NOTION_VERSION = '2022-06-28';
const token = () => process.env.NOTION_TOKEN;

async function notion(path, method = 'POST', body) {
  if (!token()) return { skipped: true, reason: 'NOTION_TOKEN not set' };
  try {
    const res = await fetch(`https://api.notion.com/v1/${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${token()}`,
        'Notion-Version': NOTION_VERSION,
        'Content-Type': 'application/json'
      },
      body: body ? JSON.stringify(body) : undefined
    });
    const data = await res.json();
    if (!res.ok) return { error: `Notion ${res.status}: ${data.message || ''}` };
    return { data };
  } catch (e) {
    return { error: String(e) };
  }
}

const title = (t) => ({ title: [{ text: { content: String(t || '').slice(0, 1900) } }] });
const rich  = (t) => ({ rich_text: [{ text: { content: String(t || '').slice(0, 1900) } }] });
const num   = (n) => (n == null ? { number: null } : { number: Number(n) });
const date  = (d) => (d ? { date: { start: d } } : { date: null });
const select = (s) => (s ? { select: { name: String(s).slice(0, 90) } } : { select: null });

// Push one day's summary into the Daily Tracker DB.
export async function syncDailyLog({ the_date, mode, status, energy, mood, summary }) {
  const db = process.env.NOTION_DAILY_DB_ID;
  if (!db) return { skipped: true, reason: 'NOTION_DAILY_DB_ID not set' };
  return notion('pages', 'POST', {
    parent: { database_id: db },
    properties: {
      Date: { ...title(the_date) },
      When: date(the_date),
      Mode: select(mode),
      Status: select(status),
      Energy: num(energy),
      Mood: num(mood),
      Summary: rich(summary)
    }
  });
}

export async function syncQuestion(q) {
  const db = process.env.NOTION_QUESTIONS_DB_ID;
  if (!db) return { skipped: true, reason: 'NOTION_QUESTIONS_DB_ID not set' };
  return notion('pages', 'POST', {
    parent: { database_id: db },
    properties: {
      Question: { ...title(q.question) },
      Topic: select(q.topic),
      Difficulty: select(q.difficulty),
      Status: select(q.status),
      Answer: rich(q.my_answer)
    }
  });
}

export async function syncApplication(a) {
  const db = process.env.NOTION_APPLICATIONS_DB_ID;
  if (!db) return { skipped: true, reason: 'NOTION_APPLICATIONS_DB_ID not set' };
  return notion('pages', 'POST', {
    parent: { database_id: db },
    properties: {
      Company: { ...title(a.company) },
      Role: rich(a.role),
      Location: rich(a.location),
      Source: select(a.source),
      Status: select(a.status),
      Applied: date(a.applied_date)
    }
  });
}
