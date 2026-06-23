import React, { useEffect, useState } from 'react';
import { api } from '../api.js';
import { EmptyState, ErrorState, LoadingState } from '../components/States.jsx';

const SOURCES   = ['LinkedIn', 'Naukri', 'Instahyre', 'Referral', 'Company Site', 'Wellfound', 'Cutshort', 'Hirist', 'Other'];
// These match Notion's Job Applications DB status options exactly
const STATUSES  = ['Target', 'Applied', 'Recruiter Call', 'Tech Round', 'HR Round', 'Offer', 'Rejected', 'Paused'];
const LOCATIONS = ['Pune', 'Bangalore', 'Remote', 'Ahmedabad', 'Other'];

const STATUS_COLOR = {
  Target:           { bg: 'rgba(107,116,128,0.12)', color: '#77869a' },
  Applied:          { bg: 'rgba(99,140,175,0.15)',  color: '#62c7f5' },
  'Recruiter Call': { bg: 'rgba(244,185,91,0.15)',  color: '#f4b95b' },
  'Tech Round':     { bg: 'rgba(169,184,255,0.15)', color: '#a9b8ff' },
  'HR Round':       { bg: 'rgba(251,139,139,0.15)', color: '#fb8b8b' },
  Offer:            { bg: 'rgba(95,208,165,0.18)',  color: '#5fd0a5' },
  Rejected:         { bg: 'rgba(107,116,128,0.15)', color: '#77869a' },
  Paused:           { bg: 'rgba(107,116,128,0.10)', color: '#77869a' },
};

const BLANK = {
  company: '', role: '', location: 'Pune', source: 'LinkedIn',
  stack: '', status: 'Applied', applied_date: new Date().toISOString().slice(0, 10),
  recruiter: '', interview_date: '', questions_asked: '', result: ''
};

function StatusBadge({ status }) {
  const s = STATUS_COLOR[status] || STATUS_COLOR.Applied;
  return (
    <span style={{
      background: s.bg, color: s.color,
      padding: '2px 9px', borderRadius: 99, fontSize: 11.5, fontWeight: 700, whiteSpace: 'nowrap'
    }}>{status}</span>
  );
}

function AppCard({ app, onUpdate, onDelete }) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState(app);
  const [busy, setBusy] = useState(false);

  function up(k, v) { setForm(f => ({ ...f, [k]: v })); }

  async function save() {
    setBusy(true);
    try {
      const { item } = await api.update('applications', app.id, form);
      onUpdate(item);
      setEditing(false);
    } catch (e) { console.error(e); }
    setBusy(false);
  }

  async function cycleStatus() {
    const next = STATUSES[(STATUSES.indexOf(app.status) + 1) % STATUSES.length];
    try {
      const { item } = await api.update('applications', app.id, { ...app, status: next });
      onUpdate(item);
    } catch (e) { console.error(e); }
  }

  async function del() {
    if (!window.confirm(`Remove ${app.company}?`)) return;
    try { await api.remove('applications', app.id); onDelete(app.id); } catch (e) { console.error(e); }
  }

  const dateStr = app.applied_date
    ? new Date(app.applied_date + 'T00:00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
    : '';

  return (
    <div className="list-item app-card" style={{ cursor: 'pointer' }}>
      <div onClick={() => setOpen(o => !o)} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <b style={{ fontSize: 15 }}>{app.company}</b>
            <StatusBadge status={app.status} />
            {app.location && <span className="faint" style={{ fontSize: 12 }}>{app.location}</span>}
          </div>
          <div className="muted" style={{ fontSize: 13, marginTop: 3 }}>{app.role || 'Role not specified'}</div>
          {app.stack && <div className="faint" style={{ fontSize: 12, marginTop: 2 }}>{app.stack}</div>}
        </div>
        <div style={{ textAlign: 'right', flex: 'none' }}>
          <div className="faint" style={{ fontSize: 12 }}>{dateStr}</div>
          {app.source && <div className="faint" style={{ fontSize: 11, marginTop: 2 }}>{app.source}</div>}
        </div>
      </div>

      {open && !editing && (
        <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--border-soft)' }}>
          {app.recruiter && <p className="muted" style={{ margin: '0 0 6px', fontSize: 13 }}>Recruiter: {app.recruiter}</p>}
          {app.interview_date && <p className="muted" style={{ margin: '0 0 6px', fontSize: 13 }}>Interview: {app.interview_date}</p>}
          {app.questions_asked && (
            <div style={{ marginBottom: 8 }}>
              <div className="faint" style={{ fontSize: 11.5, marginBottom: 3 }}>Questions asked</div>
              <p className="muted" style={{ margin: 0, fontSize: 13, whiteSpace: 'pre-wrap' }}>{app.questions_asked}</p>
            </div>
          )}
          {app.result && (
            <div style={{ marginBottom: 8 }}>
              <div className="faint" style={{ fontSize: 11.5, marginBottom: 3 }}>Outcome / notes</div>
              <p className="muted" style={{ margin: 0, fontSize: 13 }}>{app.result}</p>
            </div>
          )}
          <div className="row" style={{ marginTop: 10 }}>
            <button className="btn sm ghost" onClick={cycleStatus}>Next status →</button>
            <button className="btn sm ghost" onClick={() => { setEditing(true); setForm(app); }}>Edit</button>
            <button className="btn sm ghost" style={{ color: '#e08a7a' }} onClick={del}>Remove</button>
          </div>
        </div>
      )}

      {editing && (
        <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--border-soft)' }}>
          <div className="diary-grid" style={{ marginBottom: 10 }}>
            <label className="field-block"><span>Company</span><input value={form.company} onChange={e => up('company', e.target.value)} /></label>
            <label className="field-block"><span>Role</span><input value={form.role} onChange={e => up('role', e.target.value)} /></label>
            <label className="field-block">
              <span>Status</span>
              <select value={form.status} onChange={e => up('status', e.target.value)}>
                {STATUSES.map(s => <option key={s}>{s}</option>)}
              </select>
            </label>
            <label className="field-block">
              <span>Location</span>
              <select value={form.location} onChange={e => up('location', e.target.value)}>
                {LOCATIONS.map(l => <option key={l}>{l}</option>)}
              </select>
            </label>
            <label className="field-block"><span>Stack / keywords</span><input value={form.stack} onChange={e => up('stack', e.target.value)} /></label>
            <label className="field-block"><span>Recruiter</span><input value={form.recruiter} onChange={e => up('recruiter', e.target.value)} /></label>
            <label className="field-block"><span>Applied date</span><input type="date" value={form.applied_date} onChange={e => up('applied_date', e.target.value)} /></label>
            <label className="field-block"><span>Interview date</span><input type="date" value={form.interview_date || ''} onChange={e => up('interview_date', e.target.value)} /></label>
          </div>
          <label className="field-block" style={{ marginBottom: 8 }}>
            <span>Questions they asked</span>
            <textarea value={form.questions_asked || ''} onChange={e => up('questions_asked', e.target.value)} style={{ minHeight: 80 }} placeholder="Write what they asked — this helps plan the next pass" />
          </label>
          <label className="field-block" style={{ marginBottom: 10 }}>
            <span>Outcome / notes</span>
            <input value={form.result || ''} onChange={e => up('result', e.target.value)} />
          </label>
          <div className="row">
            <button className="btn primary sm" onClick={save} disabled={busy}>{busy ? 'Saving…' : 'Save'}</button>
            <button className="btn ghost sm" onClick={() => setEditing(false)}>Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function Applications() {
  const [items, setItems] = useState([]);
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('All');
  const [form, setForm] = useState(BLANK);
  const [adding, setAdding] = useState(false);
  const [busy, setBusy] = useState(false);

  async function load() {
    try { setErr(''); setLoading(true); const r = await api.list('applications'); setItems(r.items); }
    catch (e) { setErr(e.message); }
    finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []);

  async function add() {
    if (!form.company.trim()) return;
    setBusy(true);
    try {
      const { item } = await api.create('applications', form);
      setItems(prev => [item, ...prev]);
      setForm({ ...BLANK, applied_date: new Date().toISOString().slice(0, 10) });
      setAdding(false);
    } catch (e) { setErr(e.message); }
    setBusy(false);
  }

  function onUpdate(updated) { setItems(prev => prev.map(i => i.id === updated.id ? updated : i)); }
  function onDelete(id) { setItems(prev => prev.filter(i => i.id !== id)); }

  if (loading) return <LoadingState>Loading applications…</LoadingState>;
  if (err && items.length === 0) return <ErrorState title="Applications need the database" message={err} hint="Add DATABASE_URL or Supabase credentials in server/.env." onRetry={load} />;

  const counts = STATUSES.reduce((acc, s) => { acc[s] = items.filter(i => i.status === s).length; return acc; }, {});
  const active = items.filter(i => !['Offer', 'Rejected', 'Paused'].includes(i.status)).length;
  const filtered = filter === 'All' ? items : items.filter(i => i.status === filter);

  return (
    <div className="fade-in">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h2 className="section-title" style={{ margin: 0 }}>Applications</h2>
        <button className="btn primary sm" onClick={() => setAdding(a => !a)}>
          {adding ? 'Cancel' : '+ Log application'}
        </button>
      </div>

      {/* Stats */}
      <div className="stat-grid" style={{ marginBottom: 14 }}>
        <div className="stat"><div className="n">{items.length}</div><div className="k">total sent</div></div>
        <div className="stat"><div className="n" style={{ color: 'var(--sage)' }}>{active}</div><div className="k">in progress</div></div>
        <div className="stat"><div className="n" style={{ color: 'var(--amber)' }}>{(counts['Recruiter Call'] || 0) + (counts['Tech Round'] || 0) + (counts['HR Round'] || 0)}</div><div className="k">interview rounds</div></div>
        <div className="stat"><div className="n" style={{ color: '#5fd0a5' }}>{counts.Offer || 0}</div><div className="k">offers</div></div>
      </div>

      {/* Add form */}
      {adding && (
        <div className="card" style={{ marginBottom: 14, borderColor: 'rgba(244,185,91,0.3)' }}>
          <div className="label-row"><h3>Log a new application</h3></div>
          <div className="diary-grid" style={{ marginBottom: 10 }}>
            <label className="field-block"><span>Company *</span><input value={form.company} onChange={e => setForm(f => ({ ...f, company: e.target.value }))} placeholder="e.g. Juspay" /></label>
            <label className="field-block"><span>Role</span><input value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))} placeholder="e.g. Senior .NET Developer" /></label>
            <label className="field-block">
              <span>Location</span>
              <select value={form.location} onChange={e => setForm(f => ({ ...f, location: e.target.value }))}>
                {LOCATIONS.map(l => <option key={l}>{l}</option>)}
              </select>
            </label>
            <label className="field-block">
              <span>Source</span>
              <select value={form.source} onChange={e => setForm(f => ({ ...f, source: e.target.value }))}>
                {SOURCES.map(s => <option key={s}>{s}</option>)}
              </select>
            </label>
            <label className="field-block"><span>Stack / keywords</span><input value={form.stack} onChange={e => setForm(f => ({ ...f, stack: e.target.value }))} placeholder="e.g. .NET Core, React, Azure" /></label>
            <label className="field-block"><span>Applied date</span><input type="date" value={form.applied_date} onChange={e => setForm(f => ({ ...f, applied_date: e.target.value }))} /></label>
          </div>
          {err && <div className="error" style={{ marginBottom: 8 }}>{err}</div>}
          <button className="btn primary" onClick={add} disabled={busy || !form.company.trim()}>
            {busy ? 'Logging…' : 'Log it'}
          </button>
        </div>
      )}

      {/* Status filter */}
      {items.length > 0 && (
        <div className="row" style={{ marginBottom: 14, flexWrap: 'wrap' }}>
          {['All', ...STATUSES].map(s => {
            const cnt = s === 'All' ? items.length : counts[s] || 0;
            return (
              <button key={s} className={`chip ${filter === s ? 'on' : ''}`} onClick={() => setFilter(s)}>
                {s} {cnt > 0 && <span style={{ opacity: 0.7, marginLeft: 3 }}>{cnt}</span>}
              </button>
            );
          })}
        </div>
      )}

      {/* Rule reminder */}
      <div className="card" style={{ marginBottom: 14, padding: '12px 14px', background: 'var(--panel-wash)', borderColor: 'var(--border-soft)' }}>
        <p className="faint" style={{ margin: 0, fontSize: 12.5 }}>
          Rule: every interview is practice data. Write questions asked within 30 minutes after. Plan the next pass within 48 hours.
        </p>
      </div>

      {filtered.length === 0 && (
        <EmptyState
          title={filter === 'All' ? 'No applications yet' : `No ${filter} applications`}
          message={filter === 'All' ? "Start logging after Week 3. Use interviews as practice data while you're still prepping." : 'Try a different filter.'}
        />
      )}

      {filtered.map(app => (
        <AppCard key={app.id} app={app} onUpdate={onUpdate} onDelete={onDelete} />
      ))}
    </div>
  );
}
