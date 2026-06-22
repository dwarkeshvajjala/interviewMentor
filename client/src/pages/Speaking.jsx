import React, { useCallback, useEffect, useState } from 'react';
import { api } from '../api.js';
import { EmptyState, ErrorState, LoadingState } from '../components/States.jsx';
import { useSpeechInput } from '../useSpeechInput.js';

const PROMPT_GROUPS = {
  'Intro & Switch': [
    'Tell me about yourself',
    'Why are you looking for a change?',
    'Walk me through your career so far',
    'What kind of role are you targeting and why?',
    'How would you describe your coding level right now?',
  ],
  'C# / .NET': [
    'What is the difference between a value type and a reference type?',
    'Explain async/await — does it create a new thread?',
    'What are the three DI lifetimes and when does each bite you?',
    'What is the ASP.NET Core middleware pipeline?',
    'IEnumerable vs IQueryable — when does the query actually run?',
    'Why can .Result on a Task cause a deadlock?',
    'Interface vs abstract class — which do you choose and why?',
    'What is EF Core and what is the N+1 problem?',
    'Explain the Repository pattern in your own words',
    'What is JWT and how does the login-to-API flow work?',
  ],
  'SQL': [
    'INNER JOIN vs LEFT JOIN — give me an example of when you need each',
    'Explain ROW_NUMBER() OVER (PARTITION BY ...) with a real example',
    'How would you investigate a slow stored procedure?',
    'What is a clustered vs non-clustered index?',
    'What caused the deadlock in the healthcare project and how did you fix it?',
    'When would you use a CTE vs a subquery?',
    'What is an execution plan and what are you looking for in it?',
    'Explain the 40% performance improvement story end to end',
  ],
  'JavaScript / TypeScript': [
    'What is a closure and give a real use case',
    'Promise vs async/await — when do you prefer each?',
    'Explain the JavaScript event loop',
    'type vs interface in TypeScript — which do you use and why?',
    'What are TypeScript generics? Give me a practical example',
    'var vs let vs const — what changed and why it matters',
  ],
  'React / Angular': [
    'Controlled vs uncontrolled inputs in React',
    'Why does the useEffect dependency array matter?',
    'When do you actually need Redux vs Context API?',
    'Observable vs Promise in Angular',
    'How does Angular DI work? What does "providing" a service mean?',
    'What is an HTTP interceptor and what did you use it for?',
    'Reactive forms vs template forms — when do you reach for each?',
  ],
  'Azure / AI': [
    'Why did you use Azure App Service instead of running on a VM?',
    'Azure Functions vs Web API — when do you choose Functions?',
    'How does an app read secrets from Key Vault without storing them?',
    'Azure OpenAI vs OpenAI — why would an enterprise choose Azure?',
    'How did you integrate Claude into the wellness SaaS?',
    'What is a managed identity and why is it safer than a connection string?',
    'Walk me through your Azure DevOps pipeline setup',
  ],
  'Project Defense': [
    'Explain the wellness SaaS admin panel — what did you own?',
    'How did SignalR work in the wellness SaaS live dashboard?',
    'Walk me through the HRMS leave approval flow',
    'What did Azure Functions actually trigger on in the HRMS?',
    'Explain the healthcare scan storage and security setup',
    'What was the zero-downtime strategy for the postal migration?',
    'What was the hardest bug you fixed in any of these projects?',
    'If I asked you to redesign the HRMS from scratch today, what would you change?',
  ],
  'Behavioral / STAR': [
    'Tell me about a time you improved system performance significantly',
    'Describe a situation where you had to learn something quickly',
    'Tell me about a conflict with a teammate and how you resolved it',
    'When did you take ownership of something beyond your scope?',
    'Tell me about a time a project went sideways — what did you do?',
    'What is the project you are most proud of and why?',
    'Describe a time you disagreed with a technical decision',
    'How do you handle pressure and tight deadlines?',
  ],
  'System Design': [
    'Design a notification service — queue, retries, idempotency',
    'Design the HRMS leave approval system from scratch',
    'How would you design a file upload and processing pipeline on Azure?',
    'Design an AI report generation system — frontend to AI to storage',
    'How would you make the wellness SaaS backend handle 10x more users?',
  ],
  'Self-awareness': [
    'What is your biggest technical blind spot right now?',
    'What if you do not know the answer to a technical question?',
    'How do you stay current with .NET and Azure updates?',
    'What does "full-stack" mean to you given your background?',
    'What would your first 30 days look like in this role?',
  ],
};

const ALL_PROMPTS = Object.values(PROMPT_GROUPS).flat();
const PROMPTS = ALL_PROMPTS; // backward compat

export default function Speaking() {
  const [items, setItems] = useState([]);
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(true);
  const [promptGroup, setPromptGroup] = useState('Intro & Switch');
  const [form, setForm] = useState({ prompt: PROMPTS[0], duration_s: 75, clarity: 3, pace: 3, confidence: 3, transcript: '', one_fix: '' });
  const [mock, setMock] = useState(null);
  const [mockBusy, setMockBusy] = useState(false);
  const appendTranscript = useCallback((text) => {
    setForm(prev => ({ ...prev, transcript: `${prev.transcript}${prev.transcript ? ' ' : ''}${text}` }));
  }, []);
  const speech = useSpeechInput(appendTranscript);

  async function load() {
    try {
      setErr('');
      setLoading(true);
      const r = await api.list('recordings');
      setItems(r.items);
    } catch (e) {
      setErr(e.message);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { load(); }, []);

  async function add() {
    try { await api.create('recordings', form); setForm({ ...form, transcript: '', one_fix: '' }); load(); } catch (e) { setErr(e.message); }
  }
  async function runMock() {
    setMockBusy(true); setMock(null);
    try { setMock(await api.mock({})); } catch (e) { setErr(e.message); }
    setMockBusy(false);
  }

  const Scale = ({ k, label }) => (
    <div className="row" style={{ marginBottom: 6 }}>
      <span className="faint" style={{ width: 84 }}>{label}</span>
      {[1, 2, 3, 4, 5].map(n => (
        <button key={n} className={`chip scale ${form[k] === n ? 'on' : ''}`} onClick={() => setForm({ ...form, [k]: n })}>{n}</button>
      ))}
    </div>
  );

  if (loading) return <LoadingState>Loading speaking log...</LoadingState>;
  if (err && items.length === 0 && !mock) {
    return (
      <ErrorState
        title="Speaking log needs the database"
        message={err}
        hint="Add DATABASE_URL or Supabase credentials in server/.env for logs. The mock generator also needs GROQ_API_KEY."
        onRetry={load}
      />
    );
  }

  return (
    <div className="fade-in">
      <h2 className="section-title">Speaking</h2>

      <div className="card" style={{ marginBottom: 14 }}>
        <div className="label-row"><h3>Generate a 4-question mock</h3>
          <button className="btn sm" onClick={runMock} disabled={mockBusy}>{mockBusy ? '...' : 'New mock'}</button></div>
        {mock?.error && <div className="error">{mock.error}</div>}
        {mock?.intro && <p className="muted" style={{ marginTop: 6 }}>{mock.intro}</p>}
        {mock?.questions?.map((q, i) => (
          <div key={i} className="list-item" style={{ marginTop: 8 }}>
            <span className="pill">{q.area}</span>
            <div style={{ fontWeight: 500, marginTop: 6 }}>{q.question}</div>
            <div className="faint" style={{ marginTop: 4 }}>Good answer: {q.what_good_looks_like}</div>
          </div>
        ))}
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="label-row"><h3>Log a recording</h3></div>

        {/* Topic group tabs */}
        <div className="row" style={{ marginBottom: 10, flexWrap: 'wrap', gap: 6 }}>
          {Object.keys(PROMPT_GROUPS).map(g => (
            <button
              key={g}
              className={`chip ${promptGroup === g ? 'on' : ''}`}
              style={{ fontSize: 12 }}
              onClick={() => {
                setPromptGroup(g);
                setForm(f => ({ ...f, prompt: PROMPT_GROUPS[g][0] }));
              }}
            >{g}</button>
          ))}
        </div>

        <select value={form.prompt} onChange={e => setForm({ ...form, prompt: e.target.value })} style={{ marginBottom: 10 }}>
          {(PROMPT_GROUPS[promptGroup] || ALL_PROMPTS).map(p => <option key={p}>{p}</option>)}
        </select>
        <Scale k="clarity" label="Clarity" />
        <Scale k="pace" label="Pace" />
        <Scale k="confidence" label="Confidence" />
        <textarea
          placeholder="Transcript or rough notes from your answer..."
          value={form.transcript}
          onChange={e => setForm({ ...form, transcript: e.target.value })}
          style={{ marginTop: 8 }}
        />
        {speech.supported && (
          <button className={`btn sm ghost ${speech.listening ? 'listening' : ''}`} onClick={speech.toggle} style={{ marginTop: 8 }}>
            {speech.listening ? 'Stop dictation' : 'Dictate answer'}
          </button>
        )}
        <input placeholder="One fix for next time" value={form.one_fix} onChange={e => setForm({ ...form, one_fix: e.target.value })} style={{ marginTop: 6 }} />
        <div className="row" style={{ marginTop: 10 }}><button className="btn primary" onClick={add}>Log it</button></div>
      </div>

      {err && <div className="error">{err}</div>}

      {items.map(r => (
        <div key={r.id} className="list-item">
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <b>{r.prompt}</b>
            <span className="faint">{new Date(r.created_at).toLocaleDateString()}</span>
          </div>
          <div className="faint" style={{ marginTop: 4 }}>clarity {r.clarity} - pace {r.pace} - confidence {r.confidence}</div>
          {r.transcript && <div className="muted" style={{ marginTop: 4 }}>{r.transcript}</div>}
          {r.one_fix && <div className="muted" style={{ marginTop: 4 }}>Fix: {r.one_fix}</div>}
        </div>
      ))}
      {items.length === 0 && (
        <EmptyState
          title="No recordings logged yet"
          message="Record one answer today. Even 30 seconds counts."
        />
      )}
    </div>
  );
}
