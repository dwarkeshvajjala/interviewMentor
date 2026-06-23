import React, { useCallback, useEffect, useState } from 'react';
import { api } from '../api.js';
import { ErrorState, InlineNotice, LoadingState } from '../components/States.jsx';
import { useSpeechInput } from '../useSpeechInput.js';
import { getDailyCoachLine, getDailyEdge, getTimeGreeting } from '../motivation.js';

const MODES = [['full', 'Full - 2h'], ['normal', 'Normal - 90m'], ['low', 'Low - 20m']];
const DEFAULT_PACT = {
  wish: 'Become interview-ready and open better career options.',
  outcome: 'More confidence, better conversations, and a calmer path forward.',
  obstacle: 'Evenings, tiredness, and waiting to feel fully ready.',
  plan: 'If the day feels heavy, then I open Mentor and do one 10-minute sprint first.',
  friction: 'Phone away until the first sprint is done.',
  reward: 'After the sprint: music, tea, a short walk, or one relaxed break.'
};

function formatSprint(seconds) {
  const mins = Math.floor(seconds / 60);
  const secs = String(seconds % 60).padStart(2, '0');
  return `${mins}:${secs}`;
}

function Chain({ series }) {
  const recent = (series || []).slice(-14);
  if (!recent.length) return <div className="chain-label">Your chain starts with the next finished card.</div>;
  const alive = recent.filter(s => s.points > 0).length;
  return (
    <div className="chain-wrap compact">
      <div className="chain">
        {recent.map((s, i) => {
          const cls = s.points === 0 ? (s.status === 'rest' ? 'rest' : '') : s.mode;
          return <span key={i} className={`link ${cls}`} title={`${s.date} - ${s.status}`} />;
        })}
      </div>
      <div className="chain-label"><b>{alive}</b> recent wins</div>
    </div>
  );
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

  const progress = Math.min(100, Math.max(0, 100 - (secondsLeft / (target * 60)) * 100));

  return (
    <div className={`rail-panel sprint-panel ${running ? 'running' : ''}`}>
      <div className="label-row">
        <h3>Focus timer</h3>
        <span className="faint">{target}m</span>
      </div>
      <div className="sprint-time small">{formatSprint(secondsLeft)}</div>
      <div className="sprint-track"><span style={{ width: `${progress}%` }} /></div>
      <div className="row" style={{ marginTop: 10 }}>
        {[10, 20, 45].map(minutes => (
          <button key={minutes} className={`chip ${target === minutes ? 'on' : ''}`} onClick={() => chooseTarget(minutes)}>
            {minutes}
          </button>
        ))}
      </div>
      <div className="row" style={{ marginTop: 10 }}>
        <button className="btn primary sm" onClick={() => setRunning(!running)}>{running ? 'Pause' : completed ? 'Again' : 'Start'}</button>
        <button className="btn ghost sm" onClick={() => { setSecondsLeft(target * 60); setRunning(false); setCompleted(false); }}>Reset</button>
      </div>
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

function OptionalTools({ date }) {
  const edge = getDailyEdge();
  const [pact, setPact] = useState(loadPact);
  const [locked, setLocked] = useState(() => localStorage.getItem(`mentor-pact-locked-${date}`) === 'true');
  const [secondsLeft, setSecondsLeft] = useState(0);

  useEffect(() => {
    localStorage.setItem('mentor-discipline-pact-v1', JSON.stringify(pact));
  }, [pact]);

  useEffect(() => {
    setLocked(localStorage.getItem(`mentor-pact-locked-${date}`) === 'true');
  }, [date]);

  useEffect(() => {
    if (secondsLeft <= 0) return undefined;
    const timer = window.setInterval(() => setSecondsLeft(s => Math.max(s - 1, 0)), 1000);
    return () => window.clearInterval(timer);
  }, [secondsLeft]);

  function update(key, value) {
    setPact(prev => ({ ...prev, [key]: value }));
  }

  function lockToday() {
    const next = !locked;
    setLocked(next);
    localStorage.setItem(`mentor-pact-locked-${date}`, String(next));
  }

  return (
    <details className="rail-details">
      <summary>Optional tools</summary>
      <div className="tool-block">
        <div className="faint">{edge.origin}</div>
        <b>{edge.name}</b>
        <p className="muted">{edge.tip}</p>
      </div>
      <div className="tool-block">
        <div className="label-row">
          <h3>Setup rule</h3>
          <button className={`btn sm ${locked ? 'sage' : 'ghost'}`} onClick={lockToday}>
            {locked ? 'Locked' : 'Lock'}
          </button>
        </div>
        <label className="field-block"><span>Wish</span><input value={pact.wish} onChange={e => update('wish', e.target.value)} /></label>
        <label className="field-block"><span>If-then plan</span><textarea value={pact.plan} onChange={e => update('plan', e.target.value)} /></label>
      </div>
      <div className="tool-block">
        <div className="label-row">
          <h3>90-second reset</h3>
          <span className="faint">{secondsLeft > 0 ? formatSprint(secondsLeft) : 'ready'}</span>
        </div>
        <p className="muted">For crowded moments: breathe, stand up, then return to the first card.</p>
        <button className="btn ghost sm" onClick={() => setSecondsLeft(90)}>{secondsLeft > 0 ? 'Restart' : 'Start reset'}</button>
      </div>
    </details>
  );
}

function TaskCard({ task, onMove, onDragStart }) {
  return (
    <div
      className={`kanban-task ${task.done ? 'done' : ''}`}
      draggable
      onDragStart={() => onDragStart(task.id)}
    >
      <div className="task-head">
        <span className={`kind-tag kind-${task.kind}`}>{task.kind}</span>
        {task.minutes ? <span className="min">{task.minutes} min</span> : null}
      </div>
      <div className="task-title">{task.title}</div>
      <p className="task-detail">{task.detail}</p>
      <div className="task-actions">
        {task.resource_url ? <a href={task.resource_url} target="_blank" rel="noreferrer">open resource</a> : <span />}
        <button className="btn sm ghost" onClick={() => onMove(task.id)}>{task.done ? 'Move back' : 'Move done'}</button>
      </div>
    </div>
  );
}

function TaskColumn({ title, hint, tasks, done, onDropTask, children }) {
  return (
    <div
      className={`kanban-column ${done ? 'done-column' : ''}`}
      onDragOver={e => e.preventDefault()}
      onDrop={() => onDropTask(done)}
    >
      <div className="column-head">
        <h3>{title}</h3>
        <span>{tasks.length}</span>
      </div>
      <p className="faint">{hint}</p>
      <div className="kanban-list">
        {tasks.length ? children : <div className="empty-drop">Drop cards here</div>}
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
  const [draggingId, setDraggingId] = useState(null);

  const [energy, setEnergy] = useState(null);
  const [mood, setMood] = useState(null);
  const [hardThing, setHardThing] = useState('');
  const [nextStep, setNextStep] = useState('');
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
        setNextStep(t.log.what_avoided || '');
        setTomorrowMinutes(t.log.minutes_tomorrow ?? '');
      }
    } catch (e) {
      setErr(e.message);
    }
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
  const todoTasks = tasks.filter(t => !t.done);
  const doneTasks = tasks.filter(t => t.done);
  const doneCount = doneTasks.length;
  const remainingCount = todoTasks.length;
  const canClose = doneCount > 0;
  const today = new Date(day.the_date + 'T00:00:00').toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' });
  const streak = progress?.streak || 0;
  const greeting = getTimeGreeting();
  const coachLine = getDailyCoachLine({ streak, doneCount, totalTasks: tasks.length });

  async function toggle(id) {
    setErr('');
    setData(d => ({ ...d, tasks: d.tasks.map(t => t.id === id ? { ...t, done: !t.done } : t) }));
    try {
      await api.toggleTask(id);
    } catch (e) {
      setErr(e.message);
      load();
    }
  }

  function dropTask(done) {
    const task = tasks.find(t => t.id === draggingId);
    setDraggingId(null);
    if (!task || task.done === done) return;
    toggle(task.id);
  }

  async function chooseMode(m) {
    setData(d => ({ ...d, day: { ...d.day, mode: m } }));
    try {
      await api.setMode(day.the_date, m);
    } catch (e) {
      setErr(`Could not save mode: ${e.message}`);
    }
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
    setDiaryBusy(true); setDiaryMsg(''); setErr('');
    try {
      const minutes = tomorrowMinutes === '' ? null : Number(tomorrowMinutes);
      await api.saveLog({
        date: day.the_date,
        what_felt_hard: hardThing,
        what_avoided: nextStep,
        minutes_tomorrow: Number.isFinite(minutes) ? minutes : null
      });
      setDiaryMsg('Saved. Tomorrow has a clearer starting point.');
    } catch (e) {
      setErr(`Could not save notes: ${e.message}`);
      console.warn('[today] diary save failed', e);
    }
    setDiaryBusy(false);
  }

  async function finishDay(status) {
    if (status === 'done' && !canClose) {
      setErr('Move at least one task card to Done before closing the day.');
      return;
    }
    setBusy(true); setErr('');
    try {
      await api.setStatus(day.the_date, status);
      setMsg(status === 'done'
        ? 'Day closed. The streak only counted because a task card was done.'
        : 'Today is left out of the streak. Tomorrow will stay simple.');
      const p = await api.progress().catch(() => ({ series: [] }));
      setProgress(p || { series: [] });
    } catch (e) {
      setErr(e.message);
    }
    setBusy(false);
  }

  return (
    <div className="today-page fade-in">
      {err && (
        <div className="notice error" style={{ marginBottom: 14 }}>
          <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <span>{err}</span>
            <button className="btn sm ghost" onClick={() => setErr('')}>Dismiss</button>
          </div>
        </div>
      )}

      <section className="today-hero">
        <div>
          <div className="eyebrow">{greeting.label} - {today}</div>
          <h1 className="day-title">{greeting.title}</h1>
          <p className="focus">{day.focus}</p>
        </div>
        {!beforeStart && (
          <div className="hero-metrics">
            <div><b>{doneCount}/{tasks.length}</b><span>cards done</span></div>
            <div><b>{streak}</b><span>day streak</span></div>
          </div>
        )}
      </section>

      {beforeStart ? (
        <InlineNotice tone="warn">Your 90-day plan begins on its start date. Update <code>PLAN_START_DATE</code> if you want to begin today.</InlineNotice>
      ) : (
        <div className="today-layout">
          <main className="today-main">
            <section className="board-card">
              <div className="board-header">
                <div>
                  <div className="eyebrow">{day.week_label || 'Plan'} - Day {day.day_index}</div>
                  <h2>Today's sprint board</h2>
                  <p className="muted">Your first job is simple: move one card to Done. If a day is left open, unfinished cards come first tomorrow.</p>
                </div>
                <button className="btn sm ghost" onClick={replan} disabled={busy}>{busy ? 'Re-planning...' : 'Re-plan'}</button>
              </div>
              {msg && <div className="toast" style={{ marginBottom: 10 }}>{msg}</div>}
              <div className="coach-strip steady">
                <span>{coachLine.tag}</span>
                <p>{coachLine.text}</p>
              </div>
              <div className="kanban-board">
                <TaskColumn
                  title="Plan"
                  hint="Do these in order. Drag or use the button."
                  tasks={todoTasks}
                  done={false}
                  onDropTask={dropTask}
                >
                  {todoTasks.map(t => (
                    <TaskCard key={t.id} task={t} onMove={toggle} onDragStart={setDraggingId} />
                  ))}
                </TaskColumn>
                <TaskColumn
                  title="Done"
                  hint="Only cards here can close the day."
                  tasks={doneTasks}
                  done
                  onDropTask={dropTask}
                >
                  {doneTasks.map(t => (
                    <TaskCard key={t.id} task={t} onMove={toggle} onDragStart={setDraggingId} />
                  ))}
                </TaskColumn>
              </div>
            </section>

            <section className="notes-grid">
              <div className="note-panel">
                <div className="label-row"><h3>Learning note</h3><span className="faint">optional, useful</span></div>
                <input placeholder="Topic - e.g. INNER JOIN" value={noteTopic} onChange={e => setNoteTopic(e.target.value)} style={{ marginBottom: 8 }} />
                <textarea placeholder="Paste what you learned, an answer, or rough notes..." value={note} onChange={e => setNote(e.target.value)} />
                <div className="row" style={{ marginTop: 10 }}>
                  <button className="btn primary sm" onClick={sendNote} disabled={noteBusy || !note.trim()}>{noteBusy ? 'Saving...' : 'Get feedback'}</button>
                  {speech.supported && (
                    <button className={`btn ghost sm ${speech.listening ? 'listening' : ''}`} onClick={speech.toggle}>
                      {speech.listening ? 'Stop dictation' : 'Dictate'}
                    </button>
                  )}
                </div>
                {feedback && (
                  <div className="ai-box">
                    <div className="who">Coach</div>
                    <div>{feedback.ai_feedback || 'Saved. AI feedback is unavailable right now.'}</div>
                    {feedback.follow_up && <div className="follow">Test yourself: {feedback.follow_up}</div>}
                  </div>
                )}
              </div>

              <div className="note-panel">
                <div className="label-row"><h3>Tomorrow note</h3><span className="faint">end-of-day</span></div>
                <textarea
                  placeholder="What took the most energy today?"
                  value={hardThing}
                  onChange={e => setHardThing(e.target.value)}
                />
                <textarea
                  placeholder="What would make tomorrow easier?"
                  value={nextStep}
                  onChange={e => setNextStep(e.target.value)}
                  style={{ marginTop: 8 }}
                />
                <div className="row" style={{ marginTop: 10 }}>
                  <label className="mini-field">
                    <span>Tomorrow minutes</span>
                    <input type="number" min="5" max="180" value={tomorrowMinutes} onChange={e => setTomorrowMinutes(e.target.value)} placeholder="20" />
                  </label>
                  <button className="btn sage sm" onClick={saveDiary} disabled={diaryBusy}>{diaryBusy ? 'Saving...' : 'Save note'}</button>
                </div>
                {diaryMsg && <div className="toast">{diaryMsg}</div>}
              </div>
            </section>
          </main>

          <aside className="today-rail">
            <div className="rail-panel">
              <div className="label-row"><h3>Session setup</h3><span className="faint">{remainingCount} left</span></div>
              <div className="row">
                {MODES.map(([m, label]) => (
                  <button key={m} className={`chip ${day.mode === m ? 'on' : ''}`} onClick={() => chooseMode(m)}>{label}</button>
                ))}
              </div>
              <div className="divider" />
              <div className="scale-row">
                <span>Energy</span>
                {[1, 2, 3, 4, 5].map(n => (
                  <button key={n} className={`chip scale ${energy === n ? 'on' : ''}`} onClick={() => setScale('energy', n)}>{n}</button>
                ))}
              </div>
              <div className="scale-row">
                <span>Mood</span>
                {[1, 2, 3, 4, 5].map(n => (
                  <button key={n} className={`chip scale ${mood === n ? 'on' : ''}`} onClick={() => setScale('mood', n)}>{n}</button>
                ))}
              </div>
            </div>

            <FocusSprint date={day.the_date} mode={day.mode} />

            <div className="rail-panel close-panel">
              <div className="label-row"><h3>Close the day</h3></div>
              <p className="muted">This is the streak rule: the day counts only after at least one card is in Done.</p>
              <button className="btn sage" onClick={() => finishDay('done')} disabled={busy || !canClose}>Close day</button>
              {!canClose && <p className="faint">Move one card to Done first.</p>}
              <button className="btn ghost" onClick={() => finishDay('skipped')} disabled={busy}>Leave out of streak</button>
              <Chain series={progress?.series || []} />
            </div>

            <OptionalTools date={day.the_date} />
          </aside>
        </div>
      )}
    </div>
  );
}
