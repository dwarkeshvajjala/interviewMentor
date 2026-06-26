import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';
import { ErrorState, InlineNotice, LoadingState } from '../components/States.jsx';
import { getDailyCoachLine, getDailyEdge, getTimeGreeting } from '../motivation.js';

const DEFAULT_PACT = {
  wish: 'Become interview-ready and open better career options.',
  outcome: 'More confidence, better conversations, and a calmer path forward.',
  obstacle: 'Evenings, tiredness, and waiting to feel fully ready.',
  plan: 'If the day feels heavy, then I open Mentor and do one 10-minute sprint first.',
  friction: 'Phone away until the first sprint is done.',
  reward: 'After the sprint: music, tea, a short walk, or one relaxed break.'
};
const PUSH_STYLES = {
  easy: {
    label: 'Easy',
    line: 'Make it almost too small to refuse. Two clean minutes is a valid start.'
  },
  direct: {
    label: 'Direct',
    line: 'No big speech. Pick the first card, open the resource, and create evidence.'
  },
  navy: {
    label: 'Navy',
    line: 'One more clean rep before negotiation. The quit signal is information, not an order.'
  }
};
const DEFAULT_HARD_CONTRACT = 'Before I skip, I will do the ugly 2-minute version. If I still skip, no entertainment until tomorrow.';

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

function DisciplineLaunch({
  doneCount,
  totalTasks,
  remainingCount,
  firstTaskTitle,
  pushStyle,
  onPushStyle,
  reward,
  onReward
}) {
  const style = PUSH_STYLES[pushStyle] || PUSH_STYLES.easy;
  const percent = totalTasks ? Math.round((doneCount / totalTasks) * 100) : 0;
  const firstWin = doneCount > 0;

  return (
    <div className={`discipline-panel style-${pushStyle}`}>
      <div className="launch-top">
        <div>
          <div className="eyebrow">Start small</div>
          <h3>Make starting easier than quitting</h3>
          <p>
            Today's real minimum is one finished card. After that, the day has proof.
            Full sweep is a bonus, not the entry fee.
          </p>
        </div>
        <div className="finish-meter">
          <div className="finish-number">{percent}%</div>
          <div className="finish-track"><span style={{ width: `${percent}%` }} /></div>
          <span>{doneCount}/{totalTasks} cards</span>
        </div>
      </div>

      <div className="launch-grid">
        <div className="launch-step">
          <span>1</span>
          <b>Two-minute entry</b>
          <p>Open only this card: {firstTaskTitle || 'the first card'}.</p>
        </div>
        <div className="launch-step">
          <span>2</span>
          <b>If-then rescue</b>
          <p>If attention drifts, do the 90-second reset and return to the same card.</p>
        </div>
        <div className="launch-step reward-step">
          <span>3</span>
          <b>{firstWin ? 'Reward unlocked' : 'Temptation bundle'}</b>
          <input
            value={reward}
            onChange={e => onReward(e.target.value)}
            placeholder="Tea, music, walk, snack..."
          />
        </div>
      </div>

      <div className="push-row">
        <span>Coach voice</span>
        {Object.entries(PUSH_STYLES).map(([key, item]) => (
          <button key={key} className={`chip ${pushStyle === key ? 'on' : ''}`} onClick={() => onPushStyle(key)}>
            {item.label}
          </button>
        ))}
      </div>
      <p className="push-line">
        {firstWin ? `Good. ${remainingCount} card${remainingCount === 1 ? '' : 's'} left if you want the sweep. ${reward ? `Reward: ${reward}` : ''}` : style.line}
      </p>
    </div>
  );
}

function HardModePanel({ enabled, onToggle, contract, onContract, firstTaskTitle }) {
  return (
    <div className={`rail-panel hard-mode-panel ${enabled ? 'on' : ''}`}>
      <div className="label-row">
        <h3>Hard mode</h3>
        <button className={`btn sm ${enabled ? 'sage' : 'ghost'}`} onClick={() => onToggle(!enabled)}>
          {enabled ? 'On' : 'Off'}
        </button>
      </div>
      <p className="muted">
        Use this on the days where your brain starts negotiating. Skipping asks for
        a reason, a short pause, and proof that you tried the tiny version first.
      </p>
      <div className="hard-rule">
        <span>First move</span>
        <b>{firstTaskTitle || 'Open the first card and work for 2 minutes.'}</b>
      </div>
      <label className="field-block">
        <span>Contract with yourself</span>
        <textarea value={contract} onChange={e => onContract(e.target.value)} />
      </label>
    </div>
  );
}

function CoachTools({ date, firstTaskTitle }) {
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
    const interval = window.setInterval(() => setSecondsLeft(s => Math.max(s - 1, 0)), 1000);
    return () => window.clearInterval(interval);
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
    <div className="rail-panel coach-tools">
      <div className="label-row">
        <h3>When stuck</h3>
        <span className="faint">discipline tools</span>
      </div>

      <div className="tool-highlight">
        <div className="faint">{edge.origin}</div>
        <b>{edge.name}</b>
        <p>{edge.tip}</p>
      </div>

      <div className="mini-action-grid">
        <button className="btn ghost sm" onClick={() => setSecondsLeft(90)}>
          {secondsLeft > 0 ? `Reset ${formatSprint(secondsLeft)}` : '90-sec reset'}
        </button>
        <button className={`btn sm ${locked ? 'sage' : 'ghost'}`} onClick={lockToday}>
          {locked ? 'First move locked' : 'Lock first move'}
        </button>
      </div>

      <p className="faint">
        {locked
          ? `Locked: start with "${firstTaskTitle || 'the first card'}" before opening anything else.`
          : 'Locking the first move is just a small promise to future-you. Nothing dramatic, just less negotiation.'}
      </p>

      <div className="rescue-stack">
        <div><b>Too hard?</b><span>Do the ugly two-minute version.</span></div>
        <div><b>Distracted?</b><span>Reset, stand up, come back to the same card.</span></div>
        <div><b>Almost done?</b><span>Use the one-more-rep rule before you stop.</span></div>
      </div>

      <details className="inside-details">
        <summary>Edit setup rule</summary>
        <label className="field-block"><span>Wish</span><input value={pact.wish} onChange={e => update('wish', e.target.value)} /></label>
        <label className="field-block"><span>If-then plan</span><textarea value={pact.plan} onChange={e => update('plan', e.target.value)} /></label>
      </details>

      <Link className="note-link" to="/notes">Open notebook after a card</Link>
    </div>
  );
}

function TaskCard({ task, onMove, index, onDragStart }) {
  return (
    <div
      className={`kanban-task ${task.done ? 'done' : ''}`}
      draggable
      onDragStart={() => onDragStart(task.id)}
    >
      <div className="task-head">
        <span className="task-number">{task.done ? 'Done' : `Card ${index + 1}`}</span>
        {task.minutes ? <span className="min">{task.minutes} min</span> : null}
      </div>
      <div className="task-title">{task.title}</div>
      <p className="task-detail">{task.detail}</p>
      <div className="task-actions">
        {task.resource_url ? <a href={task.resource_url} target="_blank" rel="noreferrer">open resource</a> : <span />}
        <button className="btn sm ghost" onClick={() => onMove(task.id)}>{task.done ? 'Undo' : 'Done'}</button>
      </div>
    </div>
  );
}

function TaskBoard({ todoTasks, doneTasks, onMove, onDragStart, onDrop }) {
  const columns = [
    { key: 'todo', title: 'To do', done: false, tasks: todoTasks },
    { key: 'done', title: 'Done', done: true, tasks: doneTasks }
  ];

  return (
    <div className="jira-board">
      {columns.map(column => (
        <section
          key={column.key}
          className={`jira-column ${column.done ? 'done-column' : ''}`}
          onDragOver={e => e.preventDefault()}
          onDrop={() => onDrop(column.done)}
        >
          <div className="jira-column-head">
            <h3>{column.title}</h3>
            <span>{column.tasks.length}</span>
          </div>
          <div className="jira-list">
            {column.tasks.length ? column.tasks.map((task, index) => (
              <TaskCard
                key={task.id}
                task={task}
                index={index}
                onMove={onMove}
                onDragStart={onDragStart}
              />
            )) : (
              <div className="empty-drop">Drop cards here</div>
            )}
          </div>
        </section>
      ))}
    </div>
  );
}

function TaskListView({ tasks, onMove }) {
  return (
    <div className="jira-list-view">
      {tasks.map((task, index) => (
        <div key={task.id} className={`task-row ${task.done ? 'done' : ''}`}>
          <span className="task-status">{task.done ? 'Done' : `Card ${index + 1}`}</span>
          <div className="task-row-main">
            <div className="task-title">{task.title}</div>
            <p className="task-detail">{task.detail}</p>
            {task.resource_url ? <a href={task.resource_url} target="_blank" rel="noreferrer">open resource</a> : null}
          </div>
          <button className="btn sm ghost" onClick={() => onMove(task.id)}>{task.done ? 'Undo' : 'Done'}</button>
        </div>
      ))}
    </div>
  );
}

export default function Today() {
  const [data, setData] = useState(null);
  const [progress, setProgress] = useState({ series: [], streak: 0, totalPoints: 0 });
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [pushStyle, setPushStyle] = useState(() => {
    const saved = localStorage.getItem('mentor-push-style');
    return saved && PUSH_STYLES[saved] ? saved : 'easy';
  });
  const [reward, setReward] = useState(() => (
    localStorage.getItem('mentor-first-card-reward') || 'Tea, music, or a short walk after the first card.'
  ));
  const [hardMode, setHardMode] = useState(() => localStorage.getItem('mentor-hard-mode') === 'true');
  const [hardContract, setHardContract] = useState(() => (
    localStorage.getItem('mentor-hard-contract') || DEFAULT_HARD_CONTRACT
  ));
  const [skipArmed, setSkipArmed] = useState(false);
  const [skipSeconds, setSkipSeconds] = useState(0);
  const [skipReason, setSkipReason] = useState('');
  const [entryTried, setEntryTried] = useState(false);
  const [draggingId, setDraggingId] = useState(null);
  const [boardView, setBoardView] = useState(() => localStorage.getItem('mentor-board-view') || 'board');

  useEffect(() => {
    localStorage.setItem('mentor-push-style', pushStyle);
  }, [pushStyle]);

  useEffect(() => {
    localStorage.setItem('mentor-first-card-reward', reward);
  }, [reward]);

  useEffect(() => {
    localStorage.setItem('mentor-hard-mode', String(hardMode));
  }, [hardMode]);

  useEffect(() => {
    localStorage.setItem('mentor-hard-contract', hardContract);
  }, [hardContract]);

  useEffect(() => {
    localStorage.setItem('mentor-board-view', boardView);
  }, [boardView]);

  useEffect(() => {
    if (!skipArmed || skipSeconds <= 0) return undefined;
    const interval = window.setInterval(() => setSkipSeconds(s => Math.max(s - 1, 0)), 1000);
    return () => window.clearInterval(interval);
  }, [skipArmed, skipSeconds]);

  async function load() {
    try {
      setErr('');
      const [t, p] = await Promise.all([api.getToday(), api.progress().catch(() => ({ series: [] }))]);
      setData(t);
      setProgress(p || { series: [] });
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
  const firstTaskTitle = todoTasks[0]?.title || tasks[0]?.title || '';

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
    if (!draggingId) return;
    const draggedTask = tasks.find(t => t.id === draggingId);
    setDraggingId(null);
    if (!draggedTask || draggedTask.done === done) return;
    toggle(draggingId);
  }

  async function replan() {
    setBusy(true);
    setMsg('');
    setErr('');
    try {
      const minutes = day.mode === 'low' ? 20 : day.mode === 'full' ? 120 : 90;
      const out = await api.replan({ date: day.the_date, minutes });
      setData(d => ({ ...d, tasks: out.tasks, day: { ...d.day, mode: out.mode || d.day.mode } }));
      setMsg(out.message || 'Updated the cards for today.');
    } catch (e) {
      const aiHint = e.message.includes('GROQ_API_KEY')
        ? 'AI coaching is not configured yet. Your original cards are still safe.'
        : e.message;
      setErr(aiHint);
      console.warn('[today] replan failed', e);
    }
    setBusy(false);
  }

  async function finishDay(status) {
    if (status === 'done' && !canClose) {
      setErr('Move at least one task card to Done before closing the day.');
      return;
    }
    setBusy(true);
    setErr('');
    try {
      await api.setStatus(day.the_date, status);
      setData(d => ({ ...d, day: { ...d.day, status } }));
      setMsg(status === 'done'
        ? 'Day closed. Good work.'
        : 'Today is marked skipped. Come back clean tomorrow.');
      const p = await api.progress().catch(() => ({ series: [] }));
      setProgress(p || { series: [] });
    } catch (e) {
      setErr(e.message);
    }
    setBusy(false);
  }

  function requestSkip() {
    if (!hardMode) {
      finishDay('skipped');
      return;
    }
    setSkipArmed(true);
    setSkipSeconds(20);
    setEntryTried(false);
    setSkipReason('');
    setErr('');
  }

  async function confirmHardSkip() {
    if (!entryTried || skipSeconds > 0 || skipReason.trim().length < 12) return;
    localStorage.setItem(`mentor-hard-skip-${day.the_date}`, JSON.stringify({
      reason: skipReason.trim(),
      contract: hardContract,
      at: new Date().toISOString()
    }));
    setSkipArmed(false);
    await finishDay('skipped');
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
          <p className="hero-note">{greeting.line}</p>
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
                  <div className="eyebrow">Day {day.day_index}</div>
                  <h2>Today</h2>
                  <p className="muted">Do the first card. That is enough to make today real.</p>
                </div>
                <div className="board-controls">
                  <div className="segmented" aria-label="Task view">
                    <button className={boardView === 'board' ? 'on' : ''} onClick={() => setBoardView('board')}>Board</button>
                    <button className={boardView === 'list' ? 'on' : ''} onClick={() => setBoardView('list')}>List</button>
                  </div>
                  <button className="btn sm ghost" onClick={replan} disabled={busy}>{busy ? 'Updating...' : 'Adjust cards'}</button>
                </div>
              </div>

              {msg && <div className="toast" style={{ marginBottom: 10 }}>{msg}</div>}

              {boardView === 'board' ? (
                <TaskBoard
                  todoTasks={todoTasks}
                  doneTasks={doneTasks}
                  onMove={toggle}
                  onDragStart={setDraggingId}
                  onDrop={dropTask}
                />
              ) : (
                <TaskListView tasks={[...todoTasks, ...doneTasks]} onMove={toggle} />
              )}

              <div className={`coach-strip ${coachLine.tone}`}>
                <span>{coachLine.tag}</span>
                <p>{coachLine.text}</p>
              </div>

              <section className="hard-tools-section">
                <div className="label-row hard-tools-head">
                  <div>
                    <h3>Hard mode</h3>
                    <p className="faint">Optional tools for days where starting feels slippery.</p>
                  </div>
                  <Link className="btn sm ghost" to="/resources">Need links?</Link>
                </div>
                <div className="hard-tools-grid">
                  <DisciplineLaunch
                    doneCount={doneCount}
                    totalTasks={tasks.length}
                    remainingCount={remainingCount}
                    firstTaskTitle={firstTaskTitle}
                    pushStyle={pushStyle}
                    onPushStyle={setPushStyle}
                    reward={reward}
                    onReward={setReward}
                  />
                  <HardModePanel
                    enabled={hardMode}
                    onToggle={setHardMode}
                    contract={hardContract}
                    onContract={setHardContract}
                    firstTaskTitle={firstTaskTitle}
                  />
                  <CoachTools date={day.the_date} firstTaskTitle={firstTaskTitle} />
                </div>
              </section>
            </section>
          </main>

          <aside className="today-rail">
            <div className="note-panel notes-tool">
              <div>
                <div className="label-row"><h3>Notes</h3></div>
                <p className="muted">Paste rough learning notes after a card.</p>
              </div>
              <Link className="btn primary sm" to="/notes">Open notebook</Link>
            </div>

            <div className="rail-panel close-panel">
              <div className="label-row"><h3>Close the day</h3></div>
              <p className="muted">Close after one card is done.</p>
              <button className="btn sage" onClick={() => finishDay('done')} disabled={busy || !canClose}>Close day</button>
              {!canClose && <p className="faint">Move one card to Done first.</p>}
              <button className="btn ghost" onClick={requestSkip} disabled={busy}>
                {hardMode ? 'Try to skip' : 'Skip today'}
              </button>
              {skipArmed && (
                <div className="hard-skip-box">
                  <b>Hard mode pause</b>
                  <p>Do the two-minute entry first. If you still want to skip, write the reason and wait out the pause.</p>
                  <label className="checkline">
                    <input type="checkbox" checked={entryTried} onChange={e => setEntryTried(e.target.checked)} />
                    <span>I tried the ugly 2-minute version.</span>
                  </label>
                  <textarea
                    value={skipReason}
                    onChange={e => setSkipReason(e.target.value)}
                    placeholder="Real reason for skipping today..."
                  />
                  <div className="row" style={{ marginTop: 8 }}>
                    <button
                      className="btn sm sage"
                      onClick={confirmHardSkip}
                      disabled={busy || !entryTried || skipSeconds > 0 || skipReason.trim().length < 12}
                    >
                      {skipSeconds > 0 ? `Wait ${skipSeconds}s` : 'Confirm skip'}
                    </button>
                    <button className="btn sm ghost" onClick={() => setSkipArmed(false)} disabled={busy}>Cancel</button>
                  </div>
                </div>
              )}
              <Chain series={progress?.series || []} />
            </div>

          </aside>
        </div>
      )}
    </div>
  );
}
