import { useEffect, useState } from 'react';
import { api } from '../api.js';
import { ErrorState, InlineNotice, LoadingState } from '../components/States.jsx';

const MODES = [['full', 'Full - 2h'], ['normal', 'Normal - 90m'], ['low', 'Low - 20m']];

function Chain({ series }) {
  const recent = (series || []).slice(-21);
  if (!recent.length) {
    return <div className="chain-label">Your chain starts today. The only bad day is disappearing for many in a row.</div>;
  }
  const alive = recent.filter(s => s.points > 0).length;
  return (
    <div className="chain-wrap">
      <div className="chain">
        {recent.map((s, i) => {
          const cls = s.points === 0 ? (s.status === 'rest' ? 'rest' : '') : s.mode;
          return <span key={i} className={`link ${cls}`} title={`${s.date} - ${s.status}`} />;
        })}
      </div>
      <div className="chain-label"><b>{alive}</b> days kept alive</div>
    </div>
  );
}

export default function Today() {
  const [data, setData] = useState(null);
  const [series, setSeries] = useState([]);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  const [energy, setEnergy] = useState(null);
  const [mood, setMood] = useState(null);

  const [note, setNote] = useState('');
  const [noteTopic, setNoteTopic] = useState('');
  const [feedback, setFeedback] = useState(null);
  const [noteBusy, setNoteBusy] = useState(false);

  async function load() {
    try {
      setErr('');
      const [t, p] = await Promise.all([api.getToday(), api.progress().catch(() => ({ series: [] }))]);
      setData(t);
      setSeries(p.series || []);
      if (t.log) { setEnergy(t.log.energy); setMood(t.log.mood); }
    } catch (e) { setErr(e.message); }
  }
  useEffect(() => { load(); }, []);

  if (!data && err) {
    const setupHint = err.includes('Database is not configured')
      ? 'Copy server/.env.example to server/.env, add your Supabase URL and service role key, then restart the backend.'
      : 'Check that the backend is running and your client/server passcodes match.';
    return <ErrorState title="Today needs setup" message={err} hint={setupHint} onRetry={load} />;
  }
  if (!data) return <LoadingState>Loading today...</LoadingState>;

  const { day, tasks, plan } = data;
  const beforeStart = plan?.beforeStart;
  const doneCount = tasks.filter(t => t.done).length;
  const remainingCount = Math.max(tasks.length - doneCount, 0);

  async function toggle(id) {
    setErr('');
    setData(d => ({ ...d, tasks: d.tasks.map(t => t.id === id ? { ...t, done: !t.done } : t) }));
    try { await api.toggleTask(id); } catch (e) { setErr(e.message); load(); }
  }

  async function chooseMode(m) {
    setData(d => ({ ...d, day: { ...d.day, mode: m } }));
    try { await api.setMode(day.the_date, m); } catch (e) { setErr(`Could not save mode: ${e.message}`); }
  }

  async function setScale(kind, val) {
    const e = kind === 'energy' ? val : energy;
    const mo = kind === 'mood' ? val : mood;
    if (kind === 'energy') setEnergy(val); else setMood(val);
    try {
      await api.saveLog({ date: day.the_date, energy: e, mood: mo });
    } catch (e) {
      console.warn('[today] check-in save failed', e);
      setErr(`Could not save check-in: ${e.message}`);
    }
  }

  async function replan() {
    setBusy(true); setMsg(''); setErr('');
    try {
      const minutes = day.mode === 'low' ? 20 : day.mode === 'full' ? 120 : 90;
      const out = await api.replan({ date: day.the_date, energy, mood, minutes });
      setData(d => ({ ...d, tasks: out.tasks, day: { ...d.day, mode: out.mode || d.day.mode } }));
      setMsg(out.message || 'Re-planned for today.');
    } catch (e) {
      const aiHint = e.message.includes('GROQ_API_KEY')
        ? 'AI coaching is not configured yet. Your original tasks are still safe.'
        : e.message;
      setErr(aiHint);
      console.warn('[today] replan failed', e);
    }
    setBusy(false);
  }

  async function sendNote() {
    if (!note.trim()) return;
    setNoteBusy(true); setFeedback(null); setErr('');
    try {
      const out = await api.sendNote({ topic: noteTopic, content: note });
      setFeedback(out.note);
      setNote('');
    } catch (e) {
      setErr(`Could not save note: ${e.message}`);
      console.warn('[today] note save failed', e);
    }
    setNoteBusy(false);
  }

  async function finishDay(status) {
    setBusy(true); setErr('');
    try {
      await api.setStatus(day.the_date, status);
      setMsg(status === 'done' ? 'Day marked done. Chain alive.' : status === 'rest' ? 'Rest day logged. No guilt.' : 'Logged.');
      const p = await api.progress().catch(() => ({ series: [] }));
      setSeries(p.series || []);
    } catch (e) { setErr(e.message); }
    setBusy(false);
  }

  const today = new Date(day.the_date + 'T00:00:00').toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' });

  return (
    <div className="fade-in">
      {err && (
        <div className="card" style={{ borderColor: '#5a342f', marginBottom: 14 }}>
          <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div className="error" style={{ margin: 0 }}>{err}</div>
            <button className="btn sm ghost" onClick={() => setErr('')}>Dismiss</button>
          </div>
        </div>
      )}
      <div className="card">
        <div className="eyebrow">{day.week_label || 'Plan'}{!beforeStart && ` - Day ${day.day_index}`}</div>
        <h1 className="day-title">{today}</h1>
        <p className="focus">{day.focus}</p>
        {!beforeStart && (
          <div className="today-summary">
            <div>
              <span className="summary-number">{doneCount}</span>
              <span className="summary-label">done</span>
            </div>
            <div>
              <span className="summary-number">{remainingCount}</span>
              <span className="summary-label">left</span>
            </div>
            <div>
              <span className="summary-number">{day.mode}</span>
              <span className="summary-label">mode</span>
            </div>
          </div>
        )}
        <Chain series={series} />
      </div>

      {beforeStart ? (
        <InlineNotice tone="warn">Your 90-day plan begins on its start date. Update <code>PLAN_START_DATE</code> in the backend <code>.env</code> if you want to begin today.</InlineNotice>
      ) : (
        <>
          <div className="card">
            <div className="label-row">
              <h3>Today's mode</h3>
              <span className="faint">{doneCount}/{tasks.length} done</span>
            </div>
            <div className="row">
              {MODES.map(([m, label]) => (
                <button key={m} className={`chip ${day.mode === m ? 'on' : ''}`} onClick={() => chooseMode(m)}>{label}</button>
              ))}
            </div>

            <div className="divider" />

            <div className="label-row"><h3>How are you today?</h3></div>
            <div className="row" style={{ marginBottom: 8 }}>
              <span className="faint" style={{ width: 58 }}>Energy</span>
              {[1, 2, 3, 4, 5].map(n => (
                <button key={n} className={`chip scale ${energy === n ? 'on' : ''}`} onClick={() => setScale('energy', n)}>{n}</button>
              ))}
            </div>
            <div className="row">
              <span className="faint" style={{ width: 58 }}>Mood</span>
              {[1, 2, 3, 4, 5].map(n => (
                <button key={n} className={`chip scale ${mood === n ? 'on' : ''}`} onClick={() => setScale('mood', n)}>{n}</button>
              ))}
            </div>
          </div>

          <div className="card">
            <div className="label-row">
              <h3>Three things</h3>
              <button className="btn sm ghost" onClick={replan} disabled={busy}>{busy ? 'Re-planning...' : 'Re-plan with AI'}</button>
            </div>

            {msg && <div className="toast" style={{ marginBottom: 10 }}>{msg}</div>}

            {tasks.length === 0 && <InlineNotice tone="warn">No tasks for today. Try re-planning, or it may be a review day.</InlineNotice>}

            {tasks.map(t => (
              <div key={t.id} className={`task ${t.done ? 'done' : ''}`} onClick={() => toggle(t.id)}>
                <div className="check">{'\u2713'}</div>
                <div style={{ flex: 1 }}>
                  <span className={`kind-tag kind-${t.kind}`}>{t.kind}</span>
                  <div className="task-title">{t.title}</div>
                  <p className="task-detail">{t.detail}</p>
                  <div className="task-meta">
                    {t.minutes ? <span className="min">{t.minutes} min</span> : null}
                    {t.resource_url ? <a href={t.resource_url} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()}>open resource</a> : null}
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="card">
            <div className="label-row"><h3>Paste what you learned</h3></div>
            <p className="faint" style={{ marginTop: -4, marginBottom: 10 }}>Notes, an answer you wrote, anything. You'll get quick feedback and a question to test yourself.</p>
            <input placeholder="Topic (optional) - e.g. INNER JOIN" value={noteTopic} onChange={e => setNoteTopic(e.target.value)} style={{ marginBottom: 8 }} />
            <textarea placeholder="Type or paste here..." value={note} onChange={e => setNote(e.target.value)} />
            <div className="row" style={{ marginTop: 10 }}>
              <button className="btn primary" onClick={sendNote} disabled={noteBusy || !note.trim()}>{noteBusy ? 'Saving...' : 'Get feedback'}</button>
            </div>
            {feedback && (
              <div className="ai-box">
                <div className="who">Coach</div>
                <div>{feedback.ai_feedback || 'Saved. (AI feedback unavailable - check GROQ_API_KEY.)'}</div>
                {feedback.follow_up && <div className="follow">Test yourself: {feedback.follow_up}</div>}
                {feedback.restudy_flag && <div className="restudy" style={{ marginTop: 8 }}>Worth a re-study before moving on.</div>}
              </div>
            )}
          </div>

          <div className="card">
            <div className="label-row"><h3>Close the day</h3></div>
            <div className="row">
              <button className="btn sage" onClick={() => finishDay('done')} disabled={busy}>Mark done</button>
              <button className="btn ghost" onClick={() => finishDay('rest')} disabled={busy}>Rest day</button>
            </div>
            <p className="faint" style={{ marginTop: 10 }}>A tiny day still counts. Closing the day keeps your chain honest.</p>
          </div>
        </>
      )}
    </div>
  );
}
