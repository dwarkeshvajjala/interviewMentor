import 'dotenv/config';

const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';
const MODEL = process.env.GROQ_MODEL || 'llama-3.3-70b-versatile';

// Core coaching voice — adapted from Dwarkesh's "AI Daily Coach" prompt.
const COACH_RULES = `
You are Dwarkesh's calm interview-prep coach.
- He is a 4-year .NET full-stack developer, rusty after ~10 months of low manual coding, currently on bench.
- Targets product/MNC roles in Pune/Bangalore/remote, 8-14 LPA.
- He can study max 2 hours on weekdays and struggles with consistency and confidence.
Rules: keep it simple and kind. Never guilt him for a missed day. Never overload. Always keep the daily shape to 3 things: Code, Learn, Speak. Always offer a low-energy fallback. Stay within the roadmap's current week; do not invent a brand-new syllabus.`;

async function chat(messages, { json = false, maxTokens = 700 } = {}) {
  if (!process.env.GROQ_API_KEY) {
    return { error: 'GROQ_API_KEY not set in .env' };
  }
  try {
    const res = await fetch(GROQ_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.GROQ_API_KEY}`
      },
      body: JSON.stringify({
        model: MODEL,
        temperature: 0.5,
        max_tokens: maxTokens,
        ...(json ? { response_format: { type: 'json_object' } } : {}),
        messages
      })
    });
    if (!res.ok) {
      const text = await res.text();
      return { error: `Groq ${res.status}: ${text.slice(0, 300)}` };
    }
    const data = await res.json();
    return { text: data.choices?.[0]?.message?.content || '' };
  } catch (e) {
    return { error: String(e) };
  }
}

// Re-plan today's tasks given energy/mood/available time. Returns JSON tasks.
export async function replanDay({ plan, energy, mood, minutes, recentNote }) {
  const sys = `${COACH_RULES}
Return ONLY JSON, no prose, no markdown fences. Shape:
{"mode":"full|normal|low","message":"one warm sentence","tasks":[{"kind":"code|learn|speak","title":"...","detail":"...","minutes":number}]}
Keep tasks aligned to the same week/topics as the original plan. If energy is low (1-2) or minutes < 30, shrink to a single tiny doable task per kind, or fewer tasks, and set mode to "low".`;

  const user = `Original plan for today:
Week: ${plan.weekLabel}
Focus: ${plan.focus}
Tasks: ${JSON.stringify(plan.tasks)}

Today's reality:
Energy (1-5): ${energy ?? 'unknown'}
Mood (1-5): ${mood ?? 'unknown'}
Minutes available: ${minutes ?? 'unknown'}
${recentNote ? 'Recent note from him: ' + recentNote : ''}

Adjust today's 3 tasks to fit this reality. Stay on the same topics.`;

  const out = await chat([{ role: 'system', content: sys }, { role: 'user', content: user }], { json: true });
  if (out.error) return out;
  try { return { plan: JSON.parse(out.text) }; }
  catch { return { error: 'Could not parse AI response', raw: out.text }; }
}

// Feedback on a pasted learning note.
export async function noteFeedback({ topic, content }) {
  const sys = `${COACH_RULES}
He will paste notes or an answer he wrote while studying. Give SHORT, specific feedback.
Return ONLY JSON: {"feedback":"2-3 sentences, encouraging and concrete","follow_up":"one question to test if he really gets it","restudy":true|false}
Set restudy true only if the note shows a real misunderstanding.`;
  const user = `Topic: ${topic || 'unspecified'}\n\nHis note/answer:\n${content}`;
  const out = await chat([{ role: 'system', content: sys }, { role: 'user', content: user }], { json: true });
  if (out.error) return out;
  try { return JSON.parse(out.text); }
  catch { return { feedback: out.text, follow_up: '', restudy: false }; }
}

// Generate a short mock interview for the current phase.
export async function generateMock({ phase }) {
  const sys = `${COACH_RULES}
Create a SHORT mock for his current phase. Return ONLY JSON:
{"intro":"one calm sentence","questions":[{"area":"C#|SQL|Project|Behavioral","question":"...","what_good_looks_like":"one line"}]}
Exactly 4 questions: one C#/.NET, one SQL, one project, one behavioral.`;
  const user = `Current phase: ${phase || 'basics restart'}.`;
  const out = await chat([{ role: 'system', content: sys }, { role: 'user', content: user }], { json: true, maxTokens: 800 });
  if (out.error) return out;
  try { return JSON.parse(out.text); }
  catch { return { error: 'Could not parse AI response', raw: out.text }; }
}
