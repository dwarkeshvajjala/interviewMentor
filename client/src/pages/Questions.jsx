import React, { useEffect, useMemo, useState } from 'react';
import { api } from '../api.js';
import { EmptyState, ErrorState, LoadingState } from '../components/States.jsx';

const STATUSES    = ['New', 'Learning', 'Can Answer', 'Mock Passed'];
const TOPICS      = ['C#', '.NET', 'SQL', 'DSA', 'Azure', 'AI', 'React', 'Angular', 'JavaScript', 'TypeScript', 'Behavioral', 'Project Defense'];
const CONFIDENCES = ['', '⚠️ Weak', '🤔 Medium', '💪 Strong'];

const CONF_COLOR = {
  '⚠️ Weak':   '#fb8b8b',
  '🤔 Medium': '#f4b95b',
  '💪 Strong': '#5fd0a5',
};

export default function Questions() {
  const [items, setItems]     = useState([]);
  const [err, setErr]         = useState('');
  const [loading, setLoading] = useState(true);
  const [form, setForm]       = useState({ topic: 'C#', difficulty: 'Easy', question: '' });
  const [open, setOpen]       = useState(null);
  const [answers, setAnswers] = useState({});   // { [id]: { my_answer, senior_answer } }
  const [topicFilter, setTopicFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState('All');

  async function load() {
    try {
      setErr(''); setLoading(true);
      const r = await api.list('questions');
      setItems(r.items);
    } catch (e) { setErr(e.message); }
    finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []);

  async function add() {
    if (!form.question.trim()) return;
    try { await api.create('questions', form); setForm({ ...form, question: '' }); load(); }
    catch (e) { setErr(e.message); }
  }

  async function cycleStatus(q) {
    const next = STATUSES[(STATUSES.indexOf(q.status) + 1) % STATUSES.length];
    setItems(items.map(i => i.id === q.id ? { ...i, status: next } : i));
    try { await api.update('questions', q.id, { status: next }); }
    catch (e) { setErr(e.message); }
  }

  async function cycleConfidence(q) {
    const opts = CONFIDENCES;
    const next = opts[(opts.indexOf(q.confidence || '') + 1) % opts.length];
    setItems(items.map(i => i.id === q.id ? { ...i, confidence: next } : i));
    try { await api.update('questions', q.id, { confidence: next }); }
    catch (e) { setErr(e.message); }
  }

  async function saveAnswers(q) {
    const ans = answers[q.id] || {};
    try {
      await api.update('questions', q.id, {
        my_answer: ans.my_answer ?? q.my_answer ?? '',
        senior_answer: ans.senior_answer ?? q.senior_answer ?? '',
        last_practiced: new Date().toISOString().slice(0, 10)
      });
      load();
    } catch (e) { setErr(e.message); }
  }

  async function del(id) {
    try { await api.remove('questions', id); load(); }
    catch (e) { setErr(e.message); }
  }

  function toggleOpen(q) {
    setOpen(open === q.id ? null : q.id);
    setAnswers(prev => ({
      ...prev,
      [q.id]: prev[q.id] ?? { my_answer: q.my_answer ?? '', senior_answer: q.senior_answer ?? '' }
    }));
  }

  function setAns(id, key, val) {
    setAnswers(prev => ({ ...prev, [id]: { ...(prev[id] || {}), [key]: val } }));
  }

  const filtered = useMemo(() => {
    return items.filter(q =>
      (topicFilter  === 'All' || q.topic === topicFilter) &&
      (statusFilter === 'All' || q.status === statusFilter)
    );
  }, [items, topicFilter, statusFilter]);

  // topic counts for filter pills
  const topicCounts = useMemo(() => {
    const c = {};
    items.forEach(q => { c[q.topic] = (c[q.topic] || 0) + 1; });
    return c;
  }, [items]);

  if (loading) return <LoadingState>Loading question bank…</LoadingState>;
  if (err && items.length === 0) {
    return (
      <ErrorState
        title="Question bank needs the database"
        message={err}
        hint="Add DATABASE_URL or Supabase credentials in server/.env, then restart the backend."
        onRetry={load}
      />
    );
  }

  const canAnswer = items.filter(q => q.status === 'Can Answer' || q.status === 'Mock Passed').length;

  return (
    <div className="fade-in">
      <h2 className="section-title">Question bank</h2>

      {/* Stats row */}
      <div className="stat-grid" style={{ marginBottom: 14 }}>
        <div className="stat"><div className="n">{items.length}</div><div className="k">total questions</div></div>
        <div className="stat"><div className="n" style={{ color: 'var(--sage)' }}>{canAnswer}</div><div className="k">you can answer</div></div>
        <div className="stat"><div className="n" style={{ color: 'var(--amber)' }}>{items.filter(q => q.status === 'New').length}</div><div className="k">still new</div></div>
        <div className="stat"><div className="n" style={{ color: '#fb8b8b' }}>{items.filter(q => q.confidence === '⚠️ Weak').length}</div><div className="k">need more reps</div></div>
      </div>

      {/* Add form */}
      <div className="card" style={{ marginBottom: 14 }}>
        <div className="label-row"><h3>Add a question</h3></div>
        <div className="row" style={{ marginBottom: 8 }}>
          <select value={form.topic} onChange={e => setForm({ ...form, topic: e.target.value })} style={{ width: 'auto', flex: 1 }}>
            {TOPICS.map(t => <option key={t}>{t}</option>)}
          </select>
          <select value={form.difficulty} onChange={e => setForm({ ...form, difficulty: e.target.value })} style={{ width: 'auto' }}>
            <option>Easy</option><option>Medium</option><option>Hard</option>
          </select>
        </div>
        <input
          placeholder="Question you got asked, or one that scares you…"
          value={form.question}
          onChange={e => setForm({ ...form, question: e.target.value })}
          onKeyDown={e => e.key === 'Enter' && add()}
        />
        <div className="row" style={{ marginTop: 10 }}>
          <button className="btn primary" onClick={add}>Add question</button>
        </div>
      </div>

      {err && <div className="error" style={{ marginBottom: 10 }}>{err}</div>}

      {/* Topic filter */}
      {items.length > 0 && (
        <div className="row" style={{ marginBottom: 8, flexWrap: 'wrap' }}>
          {['All', ...TOPICS.filter(t => topicCounts[t])].map(t => (
            <button key={t} className={`chip ${topicFilter === t ? 'on' : ''}`} style={{ fontSize: 12 }} onClick={() => setTopicFilter(t)}>
              {t}{t !== 'All' && topicCounts[t] ? <span style={{ opacity: .65, marginLeft: 3 }}>{topicCounts[t]}</span> : null}
            </button>
          ))}
        </div>
      )}

      {/* Status filter */}
      {items.length > 0 && (
        <div className="row" style={{ marginBottom: 14 }}>
          {['All', ...STATUSES].map(s => (
            <button key={s} className={`chip ${statusFilter === s ? 'on' : ''}`} style={{ fontSize: 12 }} onClick={() => setStatusFilter(s)}>
              {s}
            </button>
          ))}
        </div>
      )}

      {filtered.map(q => (
        <div key={q.id} className="list-item" style={{ marginBottom: 8 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
            <div style={{ flex: 1 }}>
              <div className="row" style={{ gap: 6, marginBottom: 4 }}>
                <span className="pill">{q.topic}</span>
                <span className="faint" style={{ fontSize: 11.5 }}>{q.difficulty}</span>
                {q.last_practiced && (
                  <span className="faint" style={{ fontSize: 11 }}>
                    practiced {new Date(q.last_practiced + 'T00:00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                  </span>
                )}
              </div>
              <div style={{ fontWeight: 500, marginTop: 2 }}>{q.question}</div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5, flex: 'none', alignItems: 'flex-end' }}>
              <button className="chip" style={{ fontSize: 11.5 }} onClick={() => cycleStatus(q)} title="Click to advance status">
                {q.status}
              </button>
              <button
                style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  fontSize: 12, color: q.confidence ? CONF_COLOR[q.confidence] : 'var(--faint)',
                  padding: '2px 0'
                }}
                onClick={() => cycleConfidence(q)}
                title="Click to set confidence"
              >
                {q.confidence || '— confidence'}
              </button>
            </div>
          </div>

          <div className="row" style={{ marginTop: 8 }}>
            <button className="btn sm ghost" onClick={() => toggleOpen(q)}>
              {open === q.id ? 'Hide' : q.my_answer ? 'Edit answer' : 'Write answer'}
            </button>
            <button className="btn sm ghost" style={{ color: 'var(--faint)' }} onClick={() => del(q.id)}>Delete</button>
          </div>

          {open === q.id && (
            <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--border-soft)' }}>
              <label className="field-block" style={{ marginBottom: 10 }}>
                <span>My answer (in your own words)</span>
                <textarea
                  value={answers[q.id]?.my_answer ?? ''}
                  placeholder="Write it from memory. Don't copy. Struggle is the point."
                  onChange={e => setAns(q.id, 'my_answer', e.target.value)}
                  style={{ minHeight: 90 }}
                />
              </label>
              <label className="field-block" style={{ marginBottom: 10 }}>
                <span style={{ color: 'var(--sage)' }}>Senior / ideal answer (reference)</span>
                <textarea
                  value={answers[q.id]?.senior_answer ?? ''}
                  placeholder="Paste the correct/ideal answer here to compare against yours later…"
                  onChange={e => setAns(q.id, 'senior_answer', e.target.value)}
                  style={{ minHeight: 80, borderColor: q.senior_answer ? 'var(--sage-dim)' : undefined }}
                />
              </label>
              {q.mistake && (
                <div style={{ marginBottom: 10, padding: '8px 10px', background: 'rgba(251,139,139,0.07)', borderRadius: 7, border: '1px solid rgba(251,139,139,0.25)' }}>
                  <span className="faint" style={{ fontSize: 11.5 }}>Last mistake: </span>
                  <span className="muted" style={{ fontSize: 13 }}>{q.mistake}</span>
                </div>
              )}
              <button className="btn sm sage" onClick={() => saveAnswers(q)}>Save</button>
            </div>
          )}
        </div>
      ))}

      {filtered.length === 0 && items.length > 0 && (
        <div className="center-note">No questions match this filter.</div>
      )}
      {items.length === 0 && (
        <EmptyState
          title="No questions yet"
          message="Add the ones that scare you most. This bank gets useful fast once it reflects real interviews."
        />
      )}
    </div>
  );
}
