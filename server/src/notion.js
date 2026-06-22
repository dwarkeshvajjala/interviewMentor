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

async function findPageByDate(db, theDate) {
  const result = await notion(`databases/${db}/query`, 'POST', {
    filter: { property: 'Date', date: { equals: theDate } },
    page_size: 1
  });
  if (result.error || result.skipped) return result;
  return { pageId: result.data?.results?.[0]?.id || null };
}

// ── property builders ─────────────────────────────────────────────────────────
const title    = (t) => ({ title:     [{ text: { content: String(t || '').slice(0, 1900) } }] });
const rich     = (t) => ({ rich_text: [{ text: { content: String(t || '').slice(0, 1900) } }] });
const num      = (n) => (n == null ? { number: null } : { number: Number(n) });
const date     = (d) => (d ? { date: { start: d } } : { date: null });
const select   = (s) => (s ? { select: { name: String(s).slice(0, 90) } } : { select: null });
const checkbox = (v) => ({ checkbox: Boolean(v) });

// ── mode mapping ──────────────────────────────────────────────────────────────
function modeName(mode) {
  return ({ full: 'Full', normal: 'Normal', low: 'Survival' }[mode] || mode);
}

// ── topic mapping ─────────────────────────────────────────────────────────────
function questionTopic(topic) {
  // Notion Q Bank has "Project Defense", app uses "Project" — normalise
  return topic === 'Project' ? 'Project Defense' : topic;
}

// ── speaking topic group inference ────────────────────────────────────────────
function speakingGroup(prompt) {
  const p = (prompt || '').toLowerCase();
  if (p.includes('yourself') || p.includes('change') || p.includes('career') || p.includes('switch')) return 'Intro & Switch';
  if (p.includes('c#') || p.includes('.net') || p.includes('async') || p.includes('linq') || p.includes('dependency') || p.includes('signalr') || p.includes('ef core') || p.includes('middleware')) return 'C# / .NET';
  if (p.includes('sql') || p.includes('query') || p.includes('index') || p.includes('join') || p.includes('deadlock') || p.includes('execution plan')) return 'SQL';
  if (p.includes('javascript') || p.includes('typescript') || p.includes('closure') || p.includes('promise') || p.includes('async')) return 'JS / TS';
  if (p.includes('react') || p.includes('angular') || p.includes('rxjs') || p.includes('interceptor') || p.includes('observable')) return 'React / Angular';
  if (p.includes('azure') || p.includes('claude') || p.includes('openai') || p.includes('ai') || p.includes('key vault') || p.includes('function')) return 'Azure / AI';
  if (p.includes('project') || p.includes('wellness') || p.includes('hrms') || p.includes('healthcare') || p.includes('postal') || p.includes('signalr') || p.includes('migration')) return 'Project Defense';
  if (p.includes('star') || p.includes('conflict') || p.includes('ownership') || p.includes('failure') || p.includes('proudest') || p.includes('time you')) return 'Behavioral / STAR';
  if (p.includes('design') || p.includes('notification') || p.includes('scale') || p.includes('pipeline')) return 'System Design';
  return 'Self-awareness';
}

// ── Daily Tracker sync ────────────────────────────────────────────────────────
export async function syncDailyLog({ the_date, mode, status, energy, mood, summary, week_label, duration_minutes }) {
  const db = process.env.NOTION_DAILY_DB_ID;
  if (!db) return { skipped: true, reason: 'NOTION_DAILY_DB_ID not set' };

  const isDone = status === 'done';
  const properties = {
    Day:             { ...title(the_date) },
    Date:            date(the_date),
    Mode:            select(status === 'skipped' ? 'Zero' : modeName(mode)),
    Energy:          num(energy),
    Mood:            num(mood),
    Notes:           rich(`${status || 'pending'} — ${summary || ''}`.trim()),
    'Coding Done':   checkbox(isDone),
    'Topic Done':    checkbox(isDone),
    'Speaking Done': checkbox(isDone),
    ...(week_label      ? { Week:              rich(week_label) }          : {}),
    ...(duration_minutes != null ? { 'Duration (mins)': num(duration_minutes) } : {}),
  };

  const existing = await findPageByDate(db, the_date);
  if (existing.error || existing.skipped) return existing;
  if (existing.pageId) return notion(`pages/${existing.pageId}`, 'PATCH', { properties });
  return notion('pages', 'POST', { parent: { database_id: db }, properties });
}

// ── Question Bank sync ────────────────────────────────────────────────────────
export async function syncQuestion(q) {
  const db = process.env.NOTION_QUESTIONS_DB_ID;
  if (!db) return { skipped: true, reason: 'NOTION_QUESTIONS_DB_ID not set' };
  return notion('pages', 'POST', {
    parent: { database_id: db },
    properties: {
      Question:        { ...title(q.question) },
      Topic:           select(questionTopic(q.topic)),
      Difficulty:      select(q.difficulty),
      Status:          select(q.status),
      'My Answer':     rich(q.my_answer),
      'Senior Answer': rich(q.senior_answer),
      Confidence:      select(q.confidence),
      Mistake:         rich(q.mistake),
      'Last Practiced': date(q.last_practiced)
    }
  });
}

// ── Job Applications sync ─────────────────────────────────────────────────────
export async function syncApplication(a) {
  const db = process.env.NOTION_APPLICATIONS_DB_ID;
  if (!db) return { skipped: true, reason: 'NOTION_APPLICATIONS_DB_ID not set' };

  // App now uses Notion's exact status names — no mapping needed
  const locationMap = { Bangalore: 'Bangalore', Pune: 'Pune', Remote: 'Remote', Ahmedabad: 'Ahmedabad' };
  const location = Object.keys(locationMap).find(k =>
    String(a.location || '').toLowerCase().includes(k.toLowerCase())
  ) || 'Other';

  return notion('pages', 'POST', {
    parent: { database_id: db },
    properties: {
      Company:          { ...title(a.company) },
      Role:             rich(a.role),
      Location:         select(location),
      Source:           select(a.source),
      Status:           select(a.status),
      Stack:            rich(a.stack),
      Recruiter:        rich(a.recruiter),
      'Interview Date': date(a.interview_date),
      'Applied Date':   date(a.applied_date),
      'Questions Asked': rich(a.questions_asked),
      'Follow-up':      rich(a.follow_up),
      Result:           rich(a.result)
    }
  });
}

// ── Speaking Log sync ─────────────────────────────────────────────────────────
export async function syncRecording(r) {
  const db = process.env.NOTION_SPEAKING_DB_ID;
  if (!db) return { skipped: true, reason: 'NOTION_SPEAKING_DB_ID not set' };
  return notion('pages', 'POST', {
    parent: { database_id: db },
    properties: {
      Prompt:          { ...title(r.prompt) },
      Date:            date(r.the_date || new Date().toISOString().slice(0, 10)),
      'Topic Group':   select(speakingGroup(r.prompt)),
      Clarity:         num(r.clarity),
      Pace:            num(r.pace),
      Confidence:      num(r.confidence),
      Transcript:      rich(r.transcript),
      'One Fix':       rich(r.one_fix),
      'Duration (s)':  num(r.duration_s)
    }
  });
}
