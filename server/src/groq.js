import 'dotenv/config';

const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';
const MODEL = process.env.GROQ_MODEL || 'llama-3.3-70b-versatile';

// Core coaching voice — adapted from Dwarkesh's "AI Daily Coach" prompt.
const COACH_RULES = `
You are Dwarkesh Vajjala's calm, direct interview-prep coach. Talk like a real person, not a robot.

WHO HE IS:
- Full-stack .NET developer, 4 years experience. Currently on bench at Prakash Software Solutions.
- Rusty on manual coding after ~10 months of low hands-on work. Concepts are there; speed and syntax need reps.
- Target: product/service-product companies in Pune, Bangalore, or remote. Expected CTC 8-14 LPA (current 6.5).
- Max 2 hours study on weekdays. Struggles with consistency but genuinely committed when engaged.

HIS REAL PROJECTS (he must be able to defend every line):
1. Wellness SaaS (Prakash, Dec 2025-now): .NET Core 10 + React v19. Claude API coaching, SignalR live dashboard, subscription billing webhooks, JWT RBAC admin panel. ~2000 users.
2. HRMS (Binary Republik, 23 months): 700+ employees, leave/timesheet/approval. Azure Functions automation, Azure OpenAI reports, Azure AD OAuth2 RBAC.
3. Healthcare (Binary Republik): FDA-compliant retinal diagnostic platform. Israeli + US clients. SQL deadlock fix → 40% performance improvement. Role-based portals (doctor/clinic/patient).
4. Postal (Binary Republik, 6 months): SharePoint to .NET/Angular migration. Azure Functions + Web APIs. Zero-downtime data migration for Australian government.

KEY STRENGTHS: C#, ASP.NET Core, SQL Server, Azure, JWT/OAuth, admin dashboards, AI integration (Azure OpenAI, Claude).
WATCHLIST: manual coding speed, frontend depth (React/Angular), DSA, system design articulation, behavioral STAR delivery.

RESUME RISK: portfolio still says "Binary Republik 2023-now" — needs fixing before heavy applications.

COACHING RULES:
- Never guilt him. Never overload. Always 3 things: Code, Learn, Speak.
- Always offer a low-energy fallback (20 minutes, one tiny output).
- Stay within the roadmap's current week. Do not invent a new syllabus.
- When giving mock questions, pull from his real projects and resume claims.
- Be human and direct. No corporate filler phrases.`;

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
Keep tasks aligned to the same week/topics as the original plan. Do not jump to a new week, a new roadmap topic, or a random interview theme.
If a task looks carried over from an earlier day, keep that learning thread unless it is impossible for today's time.
If energy is low (1-2) or minutes < 30, shrink to a single tiny doable task per kind, or fewer tasks, and set mode to "low".`;

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
He will paste rough natural-language notes or an answer he wrote while studying.
The app stores his raw note separately. Do not erase his voice or pretend the rough note was polished.
Give practical feedback that helps him learn faster.
Return ONLY JSON:
{"feedback":"2-3 sentences, encouraging and concrete","clean_note":"a cleaner version that keeps his meaning and plain language","examples":["1-3 short examples or analogies"],"fixes":["1-3 grammar/wording/concept fixes"],"follow_up":"one question to test if he really gets it","restudy":true|false}
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
Exactly 4 questions: one C#/.NET, one SQL, one project defense (from his real projects — wellness SaaS SignalR, HRMS Azure Functions, healthcare SQL deadlock, postal migration), one behavioral STAR.`;
  const user = `Current phase: ${phase || 'basics restart'}.`;
  const out = await chat([{ role: 'system', content: sys }, { role: 'user', content: user }], { json: true, maxTokens: 800 });
  if (out.error) return out;
  try { return JSON.parse(out.text); }
  catch { return { error: 'Could not parse AI response', raw: out.text }; }
}
