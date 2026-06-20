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

async function findDailyPage(db, theDate) {
  const result = await notion(`databases/${db}/query`, 'POST', {
    filter: { property: 'When', date: { equals: theDate } },
    page_size: 1
  });
  if (result.error || result.skipped) return result;
  return { pageId: result.data?.results?.[0]?.id || null };
}

const title = (t) => ({ title: [{ text: { content: String(t || '').slice(0, 1900) } }] });
const rich  = (t) => ({ rich_text: [{ text: { content: String(t || '').slice(0, 1900) } }] });
const num   = (n) => (n == null ? { number: null } : { number: Number(n) });
const date  = (d) => (d ? { date: { start: d } } : { date: null });
const select = (s) => (s ? { select: { name: String(s).slice(0, 90) } } : { select: null });
const checkbox = (v) => ({ checkbox: Boolean(v) });

function modeName(mode) {
  return ({ full: 'Full', normal: 'Normal', low: 'Survival' }[mode] || mode);
}

function questionTopic(topic) {
  return topic === 'Project' ? 'Project Defense' : topic;
}

function applicationSource(source) {
  return source === 'Career page' ? 'Company Site' : source;
}

function applicationStatus(status) {
  return ({
    Screen: 'Recruiter Call',
    Tech: 'Tech Round',
    Final: 'HR Round'
  }[status] || status);
}

function applicationLocation(location) {
  if (!location) return null;
  const text = String(location);
  const known = ['Bangalore', 'Pune', 'Remote', 'Ahmedabad'];
  return known.find(city => text.toLowerCase().includes(city.toLowerCase())) || 'Other';
}

// Push one day's summary into the Daily Tracker DB.
export async function syncDailyLog({ the_date, mode, status, energy, mood, summary }) {
  const db = process.env.NOTION_DAILY_DB_ID;
  if (!db) return { skipped: true, reason: 'NOTION_DAILY_DB_ID not set' };
  const properties = {
    Day: { ...title(the_date) },
    Date: date(the_date),
    Mode: select(status === 'skipped' ? 'Zero' : modeName(mode)),
    Energy: num(energy),
    Mood: num(mood),
    Notes: rich(`${status || 'pending'} - ${summary || ''}`.trim()),
    'Coding Done': checkbox(status === 'done'),
    'Topic Done': checkbox(status === 'done'),
    'Speaking Done': checkbox(status === 'done')
  };
  const existing = await findDailyPage(db, the_date);
  if (existing.error || existing.skipped) return existing;
  if (existing.pageId) {
    return notion(`pages/${existing.pageId}`, 'PATCH', { properties });
  }
  return notion('pages', 'POST', { parent: { database_id: db }, properties });
}

export async function syncQuestion(q) {
  const db = process.env.NOTION_QUESTIONS_DB_ID;
  if (!db) return { skipped: true, reason: 'NOTION_QUESTIONS_DB_ID not set' };
  return notion('pages', 'POST', {
    parent: { database_id: db },
    properties: {
      Question: { ...title(q.question) },
      Topic: select(questionTopic(q.topic)),
      Difficulty: select(q.difficulty),
      Status: select(q.status),
      'My Answer': rich(q.my_answer),
      Mistake: rich(q.mistake),
      'Last Practiced': date(q.last_practiced)
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
      Location: select(applicationLocation(a.location)),
      Source: select(applicationSource(a.source)),
      Status: select(applicationStatus(a.status)),
      Stack: rich(a.stack),
      Recruiter: rich(a.recruiter),
      'Interview Date': date(a.interview_date),
      'Questions Asked': rich(a.questions_asked),
      Result: rich(a.result),
      'Applied Date': date(a.applied_date)
    }
  });
}
