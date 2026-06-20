import React, { useCallback, useEffect, useState } from 'react';
import { api } from '../api.js';
import { EmptyState, ErrorState, LoadingState } from '../components/States.jsx';
import { useSpeechInput } from '../useSpeechInput.js';

const PROMPTS = ['Tell me about yourself', 'Why are you looking for change?', 'Explain a project (STAR)', 'Explain a technical concept', 'What if you do not know?'];

export default function Speaking() {
  const [items, setItems] = useState([]);
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(true);
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
        <select value={form.prompt} onChange={e => setForm({ ...form, prompt: e.target.value })} style={{ marginBottom: 10 }}>
          {PROMPTS.map(p => <option key={p}>{p}</option>)}
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
