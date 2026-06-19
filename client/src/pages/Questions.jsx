import React, { useEffect, useState } from 'react';
import { api } from '../api.js';
import { EmptyState, ErrorState, LoadingState } from '../components/States.jsx';

const STATUSES = ['New', 'Learning', 'Can Answer', 'Mock Passed'];
const TOPICS = ['C#', '.NET', 'SQL', 'DSA', 'Azure', 'AI', 'React', 'Angular', 'Behavioral', 'Project'];

export default function Questions() {
  const [items, setItems] = useState([]);
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ topic: 'C#', difficulty: 'Easy', question: '' });
  const [open, setOpen] = useState(null);
  const [answers, setAnswers] = useState({});

  async function load() {
    try {
      setErr('');
      setLoading(true);
      const r = await api.list('questions');
      setItems(r.items);
    } catch (e) {
      setErr(e.message);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { load(); }, []);

  async function add() {
    if (!form.question.trim()) return;
    try { await api.create('questions', form); setForm({ ...form, question: '' }); load(); } catch (e) { setErr(e.message); }
  }
  async function cycleStatus(q) {
    const next = STATUSES[(STATUSES.indexOf(q.status) + 1) % STATUSES.length];
    setItems(items.map(i => i.id === q.id ? { ...i, status: next } : i));
    try { await api.update('questions', q.id, { status: next }); } catch (e) { setErr(e.message); }
  }
  async function saveAnswer(q, my_answer) {
    try { await api.update('questions', q.id, { my_answer, last_practiced: new Date().toISOString().slice(0, 10) }); load(); } catch (e) { setErr(e.message); }
  }
  async function del(id) { try { await api.remove('questions', id); load(); } catch (e) { setErr(e.message); } }

  function toggleAnswer(q) {
    setOpen(open === q.id ? null : q.id);
    setAnswers(prev => ({ ...prev, [q.id]: prev[q.id] ?? q.my_answer ?? '' }));
  }

  if (loading) return <LoadingState>Loading question bank...</LoadingState>;
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

  return (
    <div className="fade-in">
      <h2 className="section-title">Question bank</h2>

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="row" style={{ marginBottom: 8 }}>
          <select value={form.topic} onChange={e => setForm({ ...form, topic: e.target.value })} style={{ width: 'auto', flex: 1 }}>
            {TOPICS.map(t => <option key={t}>{t}</option>)}
          </select>
          <select value={form.difficulty} onChange={e => setForm({ ...form, difficulty: e.target.value })} style={{ width: 'auto' }}>
            <option>Easy</option><option>Medium</option><option>Hard</option>
          </select>
        </div>
        <input placeholder="Add a question you got asked or fear..." value={form.question}
          onChange={e => setForm({ ...form, question: e.target.value })}
          onKeyDown={e => e.key === 'Enter' && add()} />
        <div className="row" style={{ marginTop: 10 }}><button className="btn primary" onClick={add}>Add question</button></div>
      </div>

      {err && <div className="error">{err}</div>}

      {items.map(q => (
        <div key={q.id} className="list-item">
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <div style={{ flex: 1 }}>
              <span className="pill" style={{ marginRight: 8 }}>{q.topic}</span>
              <span className="faint">{q.difficulty}</span>
              <div style={{ marginTop: 6, fontWeight: 500 }}>{q.question}</div>
            </div>
            <button className="chip sm" onClick={() => cycleStatus(q)} title="Click to advance">{q.status}</button>
          </div>
          <div className="row" style={{ marginTop: 8 }}>
            <button className="btn sm ghost" onClick={() => toggleAnswer(q)}>{open === q.id ? 'Hide' : 'My answer'}</button>
            <button className="btn sm ghost" onClick={() => del(q.id)} style={{ color: 'var(--faint)' }}>Delete</button>
          </div>
          {open === q.id && (
            <div style={{ marginTop: 10 }}>
              <textarea
                value={answers[q.id] ?? ''}
                placeholder="Write your answer in your own words..."
                onChange={e => setAnswers(prev => ({ ...prev, [q.id]: e.target.value }))}
              />
              <button className="btn sm" style={{ marginTop: 8 }}
                onClick={() => saveAnswer(q, answers[q.id] ?? '')}>Save answer</button>
            </div>
          )}
        </div>
      ))}
      {items.length === 0 && (
        <EmptyState
          title="No questions yet"
          message="Add the ones that scare you most. The bank gets useful fast once it reflects real interviews."
        />
      )}
    </div>
  );
}
