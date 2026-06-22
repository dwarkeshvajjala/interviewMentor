import React, { useCallback, useEffect, useState } from 'react';
import { api } from '../api.js';
import { ErrorState, InlineNotice, LoadingState } from '../components/States.jsx';
import { useSpeechInput } from '../useSpeechInput.js';
import { getDailyCoachLine, getTimeGreeting } from '../motivation.js';

const MODES = [['full', 'Full - 2h'], ['normal', 'Normal - 90m'], ['low', 'Low - 20m']];
const DEFAULT_PACT = {
  wish: 'Become interview-ready and build better money/options.',
  outcome: 'Confidence, freedom, and proof that I can get out of this pit.',
  obstacle: 'Evening scrolling, shame, porn urges, tiredness, and waiting to feel ready.',
  plan: 'If I want to escape, then I open Mentor and do one 10-minute sprint first.',
  friction: 'Phone away. No private tabs or random scrolling until the day is closed.',
  reward: 'After the sprint: music, tea, short walk, or one guilt-free video.'
};

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

function formatSprint(seconds) {
  const mins = Math.floor(seconds / 60);
  const secs = String(seconds % 60).padStart(2, '0');
  return `${mins}:${secs}`;
}

function FocusSprint({ date, mode }) {
  const fallbackMinutes = mode === 'full' ? 45 : mode === 'low' ? 10 : 20;
  const [target, setTarget] = useState(fallbackMinutes);
  const [secondsLeft, setSecondsLeft] = useState(fallbackMinutes * 60);
  const [running, setRunning] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setHydrated(false);
    const saved = localStorage.getItem(`mentor-sprint-${date}`);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setTarget(parsed.target || fallbackMinutes);
        setSecondsLeft(parsed.secondsLeft ?? (parsed.target || fallbackMinutes) * 60);
        setCompleted(Boolean(parsed.completed));
        setRunning(false);
        setHydrated(true);
        return;
      } catch {
        localStorage.removeItem(`mentor-sprint-${date}`);
      }
    }
    setTarget(fallbackMinutes);
    setSecondsLeft(fallbackMinutes * 60);
    setRunning(false);
    setCompleted(false);
    setHydrated(true);
  }, [date, fallbackMinutes]);

  useEffect(() => {
    if (!hydrated) return;
    localStorage.setItem(`mentor-sprint-${date}`, JSON.stringify({ target, secondsLeft, completed }));
  }, [date, target, secondsLeft, completed, hydrated]);

  useEffect(() => {
    if (!running) return undefined;
    if (secondsLeft <= 0) {
      setRunning(false);
      setCompleted(true);
      return undefined;
    }
    const timer = window.setInterval(() => setSecondsLeft(s => Math.max(s - 1, 0)), 1000);
    return () => window.clearInterval(timer);
  }, [running, secondsLeft]);

  function chooseTarget(minutes) {
    setTarget(minutes);
    setSecondsLeft(minutes * 60);
    setRunning(false);
    setCompleted(false);
  }

  function reset() {
    setSecondsLeft(target * 60);
    setRunning(false);
    setCompleted(false);
  }

  const progress = Math.min(100, Math.max(0, 100 - (secondsLeft / (target * 60)) * 100));
  const copy = completed
    ? 'Sprint complete. That is a real vote for the person you are building.'
    : running
      ? 'Stay here. One tab, one rep, one promise.'
      : 'Start a tiny sprint before your brain starts negotiating.';

  return (
    <div className={`card focus-sprint ${running ? 'running' : ''} ${completed ? 'complete' : ''}`}>
      <div className="label-row">
        <h3>Focus sprint</h3>
        <span className="faint">keep the site open, keep the promise</span>
      </div>
      <div className="sprint-body">
        <div>
          <div className="sprint-time">{formatSprint(secondsLeft)}</div>
          <p className="muted" style={{ margin: '4px 0 0' }}>{copy}</p>
        </div>
        <div className="sprint-actions">
          <div className="row">
            {[10, 20, 45].map(minutes => (
              <button key={minutes} className={`chip ${target === minutes ? 'on' : ''}`} onClick={() => chooseTarget(minutes)}>
                {minutes}m
              </button>
            ))}
          </div>
          <div className="row">
            <button className="btn primary" onClick={() => setRunning(!running)}>
              {running ? 'Pause' : completed ? 'Again' : 'Start'}
            </button>
            <button className="btn ghost" onClick={reset}>Reset</button>
          </div>
        </div>
      </div>
      <div className="sprint-track"><span style={{ width: `${progress}%` }} /></div>
    </div>
  );
}

function loadPact() {
  const saved = localStorage.getItem('mentor-discipline-pact-v1');
  if (!saved) return DEFAULT_PACT;
  try {
    return { ...DEFAULT_PACT, ...JSON.parse(saved) };
  } catch {
    localStorage.removeItem('mentor-discipline-pact-v1');
    return DEFAULT_PACT;
  }
}

function DisciplinePact({ date }) {
  const [pact, setPact] = useState(loadPact);
  const [locked, setLocked] = useState(() => localStorage.getItem(`mentor-pact-locked-${date}`) === 'true');

  useEffect(() => {
    localStorage.setItem('mentor-discipline-pact-v1', JSON.stringify(pact));
  }, [pact]);

  useEffect(() => {
    setLocked(localStorage.getItem(`mentor-pact-locked-${date}`) === 'true');
  }, [date]);

  function update(key, value) {
    setPact(prev => ({ ...prev, [key]: value }));
  }

  function lockToday() {
    const next = !locked;
    setLocked(next);
    localStorage.setItem(`mentor-pact-locked-${date}`, String(next));
  }

  return (
    <div className={`card pact-card ${locked ? 'locked' : ''}`}>
      <div className="label-row">
        <h3>Discipline pact</h3>
        <button className={`btn sm ${locked ? 'sage' : 'ghost'}`} onClick={lockToday}>
          {locked ? 'Pact locked' : 'Lock today'}
        </button>
      </div>
      <div className="pact-grid">
        <label className="field-block">
          <span>Wish</span>
          <input value={pact.wish} onChange={e => update('wish', e.target.value)} />
        </label>
        <label className="field-block">
          <span>Outcome</span>
          <input value={pact.outcome} onChange={e => update('outcome', e.target.value)} />
        </label>
        <label className="field-block">
          <span>Obstacle</span>
          <textarea value={pact.obstacle} onChange={e => update('obstacle', e.target.value)} />
        </label>
        <label className="field-block">
          <span>If-then plan</span>
          <textarea value={pact.plan} onChange={e => update('plan', e.target.value)} />
        </label>
      </div>
      <div className="pact-rules">
        <label className="field-block">
          <span>Friction rule</span>
          <input value={pact.friction} onChange={e => update('friction', e.target.value)} />
        </label>
        <label className="field-block">
          <span>Clean reward</span>
          <input value={pact.reward} onChange={e => update('reward', e.target.value)} />
        </label>
      </div>
      <p className="faint" style={{ margin: '10px 0 0' }}>
        Rule: make discipline automatic before the urge starts arguing. No shame spiral, just the next rep.
      </p>
    </div>
  );
}

function UrgeReset() {
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (secondsLeft <= 0) return undefined;
    const timer = window.setInterval(() => setSecondsLeft(s => Math.max(s - 1, 0)), 1000);
    return () => window.clearInterval(timer);
  }, [secondsLeft]);

  useEffect(() => {
    if (secondsLeft === 0 && done) setDone(false);
  }, [secondsLeft, done]);

  function start() {
    setSecondsLeft(90);
    setDone(true);
  }

  const active = secondsLeft > 0;

  return (
    <div className={`card reset-card ${active ? 'active' : ''}`}>
      <div className="label-row">
        <h3>Urge reset</h3>
        <span className="faint">for scroll, porn, panic, avoidance</span>
      </div>
      <div className="reset-layout">
        <div>
          <div className="reset-timer">{active ? formatSprint(secondsLeft) : '90s'}</div>
          <p className="muted" style={{ margin: '4px 0 0' }}>
            {active ? 'Breathe slower than the urge. It can rise without becoming a command.' : 'When the escape urge hits, start here before deciding anything.'}
          </p>
        </div>
        <ol className="reset-steps">
          <li>Name it: "this is an urge, not an order."</li>
          <li>Breathe: 4 seconds in, 6 seconds out.</li>
          <li>Move: 10 squats, pushups, or a one-minute walk.</li>
          <li>Open the first task and do a 10-minute sprint.</li>
        </ol>
      </div>
      <div className="row" style={{ marginTop: 12 }}>
        <button className="btn primary" onClick={start}>{active ? 'Restart reset' : 'Start urge reset'}</button>
        <button className="btn ghost" onClick={() => setSecondsLeft(0)}>I am back</button>
      </div>
    </div>
  );
}

export default function Today() {
  const [data, setData] = useState(null);
  const [progress, setProgress] = useState({ series: [], streak: 0, totalPoints: 0 });
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  const [energy, setEnergy] = useState(null);
  const [mood, setMood] = useState(null);
  const [hardThing, setHardThing] = useState('');
  const [avoidedThing, setAvoidedThing] = useState('');
  const [tomorrowMinutes, setTomorrowMinutes] = useState('');
  const [diaryMsg, setDiaryMsg] = useState('');
  const [diaryBusy, setDiaryBusy] = useState(false);

  const [note, setNote] = useState('');
  const [noteTopic, setNoteTopic] = useState('');
  const [feedback, setFeedback] = useState(null);
  const [noteBusy, setNoteBusy] = useState(false);
  const appendDictation = useCallback((text) => {
    setNote(prev => `${prev}${prev ? ' ' : ''}${text}`);
  }, []);
  const speech = useSpeechInput(appendDictation);

  async function load() {
    try {
      setErr('');
      const [t, p] = await Promise.all([api.getToday(), api.progress().catch(() => ({ series: [] }))]);
      setData(t);
      setProgress(p || { series: [] });
      if (t.log) {
        setEnergy(t.log.energy);
        setMood(t.log.mood);
        setHardThing(t.log.what_felt_hard || '');
        setAvoidedThing(t.log.what_avoided || '');
        setTomorrowMinutes(t.log.minutes_tomorrow ?? '');
      }
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

  async function saveDiary() {
    setDiaryBusy(true);
    setDiaryMsg('');
    setErr('');
    try {
      const minutes = tomorrowMinutes === '' ? null : Number(tomorrowMinutes);
      await api.saveLog({
        date: day.the_date,
        what_felt_hard: hardThing,
        what_avoided: avoidedThing,
        minutes_tomorrow: Number.isFinite(minutes) ? minutes : null
      });
      setDiaryMsg('Diary saved. This is your receipt for showing up.');
    } catch (e) {
      setErr(`Could not save diary: ${e.message}`);
      console.warn('[today] diary save failed', e);
    }
    setDiaryBusy(false);
  }

  async function finishDay(status) {
    setBusy(true); setErr('');
    try {
      await api.setStatus(day.the_date, status);
      setMsg(status === 'done' ? 'Day marked done. Chain alive.' : status === 'rest' ? 'Rest day logged. No guilt.' : 'Logged.');
      const p = await api.progress().catch(() => ({ series: [] }));
      setProgress(p || { series: [] });
    } catch (e) { setErr(e.message); }
    setBusy(false);
  }

  const today = new Date(day.the_date + 'T00:00:00').toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' });
  const streak = progress?.streak || 0;
  const greeting = getTimeGreeting();
  const coachLine = getDailyCoachLine({ streak, doneCount, totalTasks: tasks.length });

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
      <div className="card hero-card">
        <div className="hero-top">
          <div>
            <div className="eyebrow">{greeting.label} - {day.week_label || 'Plan'}{!beforeStart && ` - Day ${day.day_index}`}</div>
            <h1 className="day-title">{greeting.title}</h1>
            <p className="focus">{greeting.line}</p>
          </div>
          {!beforeStart && (
            <div className="streak-badge">
              <span>{streak}</span>
              <small>day streak</small>
            </div>
          )}
        </div>
        <div className={`coach-strip ${coachLine.tone}`}>
          <span>{coachLine.tag}</span>
          <p>{coachLine.text}</p>
        </div>
        <div className="day-focus">
          <span>{today}</span>
          <b>{day.focus}</b>
        </div>
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
        <Chain series={progress?.series || []} />
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

          <DisciplinePact date={day.the_date} />

          <UrgeReset />

          <FocusSprint date={day.the_date} mode={day.mode} />

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
              {speech.supported && (
                <button className={`btn ghost ${speech.listening ? 'listening' : ''}`} onClick={speech.toggle}>
                  {speech.listening ? 'Stop dictation' : 'Dictate note'}
                </button>
              )}
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

          <div className="card diary-card">
            <div className="label-row">
              <h3>Daily diary</h3>
              <span className="faint">private, honest, useful</span>
            </div>
            <div className="diary-grid">
              <label className="field-block">
                <span>What felt hard today?</span>
                <textarea
                  placeholder="Example: I avoided SQL joins because I felt slow..."
                  value={hardThing}
                  onChange={e => setHardThing(e.target.value)}
                />
              </label>
              <label className="field-block">
                <span>What did I avoid, and what is the smallest next rep?</span>
                <textarea
                  placeholder="Example: I avoided speaking. Tomorrow I will record 60 seconds."
                  value={avoidedThing}
                  onChange={e => setAvoidedThing(e.target.value)}
                />
              </label>
            </div>
            <div className="row" style={{ marginTop: 10 }}>
              <label className="mini-field">
                <span>Tomorrow promise</span>
                <input
                  type="number"
                  min="5"
                  max="180"
                  value={tomorrowMinutes}
                  onChange={e => setTomorrowMinutes(e.target.value)}
                  placeholder="20"
                />
              </label>
              <button className="btn sage" onClick={saveDiary} disabled={diaryBusy}>
                {diaryBusy ? 'Saving...' : 'Save diary'}
              </button>
            </div>
            {diaryMsg && <div className="toast">{diaryMsg}</div>}
            <p className="faint" style={{ marginTop: 10 }}>This is not for perfection. It is for spotting the exact place where tomorrow gets easier.</p>
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
