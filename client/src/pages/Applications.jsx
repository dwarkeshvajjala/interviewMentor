import { useEffect, useState } from 'react';
import { api } from '../api.js';
import { EmptyState, ErrorState, LoadingState } from '../components/States.jsx';

const STATUSES = ['Applied', 'Screen', 'Tech', 'Final', 'Offer', 'Rejected'];
const SOURCES = ['LinkedIn', 'Naukri', 'Instahyre', 'Wellfound', 'Referral', 'Career page'];

export default function Applications() {
  const [items, setItems] = useState([]);
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ company: '', role: '', location: '', source: 'LinkedIn', stack: '' });

  async function load() {
    try {
      setErr('');
      setLoading(true);
      const r = await api.list('applications');
      setItems(r.items);
    } catch (e) {
      setErr(e.message);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { load(); }, []);

  async function add() {
    if (!form.company.trim()) return;
    try { await api.create('applications', form); setForm({ company: '', role: '', location: '', source: form.source, stack: '' }); load(); } catch (e) { setErr(e.message); }
  }
  async function cycle(a) {
    const next = STATUSES[(STATUSES.indexOf(a.status) + 1) % STATUSES.length];
    setItems(items.map(i => i.id === a.id ? { ...i, status: next } : i));
    try { await api.update('applications', a.id, { status: next }); } catch (e) { setErr(e.message); }
  }
  async function del(id) { try { await api.remove('applications', id); load(); } catch (e) { setErr(e.message); } }

  const counts = STATUSES.map(s => ({ s, n: items.filter(i => i.status === s).length }));

  if (loading) return <LoadingState>Loading applications...</LoadingState>;
  if (err && items.length === 0) {
    return (
      <ErrorState
        title="Applications need the database"
        message={err}
        hint="Add DATABASE_URL or Supabase credentials in server/.env, then restart the backend."
        onRetry={load}
      />
    );
  }

  return (
    <div className="fade-in">
      <h2 className="section-title">Applications</h2>

      <div className="card" style={{ marginBottom: 14 }}>
        <div className="row">
          {counts.map(c => <span key={c.s} className="pill">{c.s}: {c.n}</span>)}
        </div>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="row" style={{ marginBottom: 8 }}>
          <input placeholder="Company" value={form.company} onChange={e => setForm({ ...form, company: e.target.value })} />
          <input placeholder="Role" value={form.role} onChange={e => setForm({ ...form, role: e.target.value })} />
        </div>
        <div className="row" style={{ marginBottom: 8 }}>
          <input placeholder="Location" value={form.location} onChange={e => setForm({ ...form, location: e.target.value })} />
          <select value={form.source} onChange={e => setForm({ ...form, source: e.target.value })} style={{ width: 'auto' }}>
            {SOURCES.map(s => <option key={s}>{s}</option>)}
          </select>
        </div>
        <input placeholder="Stack (optional)" value={form.stack} onChange={e => setForm({ ...form, stack: e.target.value })} />
        <div className="row" style={{ marginTop: 10 }}><button className="btn primary" onClick={add}>Add application</button></div>
      </div>

      {err && <div className="error">{err}</div>}

      {items.map(a => (
        <div key={a.id} className="list-item">
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <div style={{ flex: 1 }}>
              <b>{a.company}</b> <span className="muted">- {a.role || 'role n/a'}</span>
              <div className="faint" style={{ marginTop: 3 }}>{[a.location, a.source, a.stack].filter(Boolean).join(' - ')}</div>
            </div>
            <button className="chip sm" onClick={() => cycle(a)}>{a.status}</button>
          </div>
          <div className="row" style={{ marginTop: 8 }}>
            <button className="btn sm ghost" onClick={() => del(a.id)} style={{ color: 'var(--faint)' }}>Delete</button>
          </div>
        </div>
      ))}
      {items.length === 0 && (
        <EmptyState
          title="No applications yet"
          message="Start light after week 3, then get serious after week 6."
        />
      )}
    </div>
  );
}
