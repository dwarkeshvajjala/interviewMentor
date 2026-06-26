import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';
import { ErrorState, LoadingState } from '../components/States.jsx';

const INTENT_OPTIONS = [
  { value: 'mix', label: 'Best mix', help: 'Docs, practice, video, and readable posts.' },
  { value: 'video', label: 'Video first', help: 'When reading feels too heavy.' },
  { value: 'docs', label: 'Official docs', help: 'When you want reliable source material.' },
  { value: 'articles', label: 'Articles', help: 'When you need a human explanation.' },
  { value: 'practice', label: 'Practice', help: 'When you are ready to touch the keyboard.' }
];

const KIND_FILTERS = ['All', 'Reference', 'Tutorial', 'Practice', 'Video', 'Blog', 'Visual', 'Community'];

const KIND_ORDER = {
  mix: ['Reference', 'Practice', 'Tutorial', 'Video', 'Blog', 'Visual', 'Community'],
  video: ['Video', 'Tutorial', 'Reference', 'Visual', 'Blog', 'Practice', 'Community'],
  docs: ['Reference', 'Tutorial', 'Visual', 'Practice', 'Blog', 'Video', 'Community'],
  articles: ['Blog', 'Community', 'Reference', 'Tutorial', 'Video', 'Practice', 'Visual'],
  practice: ['Practice', 'Visual', 'Reference', 'Tutorial', 'Video', 'Blog', 'Community']
};

function formatDate(value) {
  if (!value) return 'Today';
  return new Date(value + 'T00:00:00').toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'short',
    day: 'numeric'
  });
}

function hostName(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return 'resource';
  }
}

function sortResources(resources, intent) {
  const order = KIND_ORDER[intent] || KIND_ORDER.mix;
  return [...resources].sort((a, b) => {
    const aRank = order.indexOf(a.kind);
    const bRank = order.indexOf(b.kind);
    const safeA = aRank === -1 ? 99 : aRank;
    const safeB = bRank === -1 ? 99 : bRank;
    return safeA - safeB;
  });
}

function ResourceCard({ item }) {
  return (
    <a className="resource-card" href={item.url} target="_blank" rel="noreferrer">
      <div className="resource-card-top">
        <span className="resource-kind">{item.kind}</span>
        <span className="resource-open">Open</span>
      </div>
      <b>{item.title}</b>
      <small>{hostName(item.url)}</small>
    </a>
  );
}

function TaskPreview({ task, index }) {
  return (
    <div className={`resource-task ${task.done ? 'done' : ''}`}>
      <span>{task.done ? 'Done' : `Card ${index + 1}`}</span>
      <b>{task.title}</b>
      {task.detail && <p>{task.detail}</p>}
    </div>
  );
}

export default function Resources() {
  const [today, setToday] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [scoutErr, setScoutErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [pack, setPack] = useState(null);
  const [intent, setIntent] = useState('mix');
  const [kindFilter, setKindFilter] = useState('All');
  const requestedRef = useRef(false);

  async function loadToday() {
    try {
      setErr('');
      setLoading(true);
      const out = await api.getToday();
      setToday(out);
    } catch (e) {
      setErr(e.message);
    } finally {
      setLoading(false);
    }
  }

  async function findLinks() {
    if (!today?.day?.the_date) return;
    setBusy(true);
    setScoutErr('');
    try {
      const out = await api.resourceScout({ date: today.day.the_date });
      setPack(out);
    } catch (e) {
      setScoutErr(`Could not find links right now: ${e.message}`);
      console.warn('[resources] scout failed', e);
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => { loadToday(); }, []);

  useEffect(() => {
    if (!today || requestedRef.current) return;
    requestedRef.current = true;
    findLinks();
  }, [today]);

  const tasks = today?.tasks || [];
  const activeTasks = tasks.filter(t => !t.done);
  const displayTasks = (activeTasks.length ? activeTasks : tasks).slice(0, 3);
  const intentHelp = INTENT_OPTIONS.find(option => option.value === intent)?.help || INTENT_OPTIONS[0].help;
  const filterChoices = useMemo(() => {
    const kinds = new Set(KIND_FILTERS);
    (pack?.resources || []).forEach(item => kinds.add(item.kind));
    return [...kinds];
  }, [pack]);

  const resources = useMemo(() => {
    const sorted = sortResources(pack?.resources || [], intent);
    return kindFilter === 'All' ? sorted : sorted.filter(item => item.kind === kindFilter);
  }, [pack, intent, kindFilter]);

  if (loading && !today) return <LoadingState>Loading resources...</LoadingState>;
  if (err && !today) {
    return (
      <ErrorState
        title="Resources need today's plan"
        message={err}
        hint="Start the backend and database first. Resource suggestions use today's unfinished cards."
        onRetry={loadToday}
      />
    );
  }

  return (
    <div className="resources-page fade-in">
      <section className="resource-hero">
        <div>
          <div className="eyebrow">Resource scout - {formatDate(today?.day?.the_date)}</div>
          <h1 className="day-title">When the card feels heavy, start with one real link.</h1>
          <p className="focus">
            AI chooses a topic from today's unfinished cards. The links stay grounded in trusted docs,
            curated practice, or real search pages so you do not waste energy chasing fake resources.
          </p>
          <div className="resource-hero-actions">
            <button className="btn primary" onClick={findLinks} disabled={busy || !today}>
              {busy ? 'Finding links...' : 'Refresh links'}
            </button>
            <Link className="btn ghost" to="/">Back to Today</Link>
          </div>
        </div>
        <div className="resource-route-card">
          <span>Low-energy route</span>
          <b>Open one link, learn for five minutes, then return to one card.</b>
          <p>No perfect mood required. Just make the next action visible.</p>
        </div>
      </section>

      <div className="resources-layout">
        <main className="resource-main-panel">
          <div className="resource-toolbar">
            <label className="select-field">
              <span>I need</span>
              <select value={intent} onChange={e => setIntent(e.target.value)}>
                {INTENT_OPTIONS.map(option => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </label>
            <label className="select-field">
              <span>Show</span>
              <select value={kindFilter} onChange={e => setKindFilter(e.target.value)}>
                {filterChoices.map(kind => <option key={kind} value={kind}>{kind}</option>)}
              </select>
            </label>
            <div className="resource-toolbar-note">{intentHelp}</div>
          </div>

          {scoutErr && (
            <div className="notice error">
              <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <span>{scoutErr}</span>
                <button className="btn sm ghost" onClick={() => setScoutErr('')}>Dismiss</button>
              </div>
            </div>
          )}

          {busy && !pack ? (
            <div className="resource-wait">
              <span className="spinner" aria-hidden="true" />
              <span>Finding a good starting point from today's cards...</span>
            </div>
          ) : null}

          {pack?.scout && (
            <div className="scout-focus-card">
              <div>
                <span className="eyebrow">Suggested topic</span>
                <h2>{pack.scout.topic}</h2>
                <p>{pack.scout.reason}</p>
              </div>
              <div className="tiny-action">
                <span>Tiny action</span>
                <b>{pack.scout.tiny_action}</b>
              </div>
            </div>
          )}

          {pack?.aiError && (
            <p className="faint">AI was unavailable, so this page used the safe fallback resource map.</p>
          )}
          {pack?.sourceNote && <p className="faint">{pack.sourceNote}</p>}

          <div className="resource-card-grid">
            {resources.map((item, index) => (
              <ResourceCard key={`${item.url}-${index}`} item={item} />
            ))}
          </div>

          {pack && resources.length === 0 && (
            <div className="empty-state">
              <div className="empty-title">No links for this filter</div>
              <p className="muted">Switch the Show filter back to All or refresh the links.</p>
            </div>
          )}
        </main>

        <aside className="resource-side">
          <div className="rail-panel">
            <div className="label-row">
              <h3>Today's cards</h3>
              <span className="faint">{activeTasks.length || tasks.length} active</span>
            </div>
            <div className="resource-task-stack">
              {displayTasks.length ? displayTasks.map((task, index) => (
                <TaskPreview key={task.id || index} task={task} index={index} />
              )) : (
                <p className="muted">No cards loaded yet. Refresh once the backend is ready.</p>
              )}
            </div>
          </div>

          <div className="rail-panel resource-playbook">
            <div className="label-row"><h3>Use it without drifting</h3></div>
            <ol>
              <li>Pick one link only.</li>
              <li>Write one rough note.</li>
              <li>Go back to Today and finish one card.</li>
            </ol>
            <Link className="note-link" to="/notes">Open notebook</Link>
          </div>
        </aside>
      </div>
    </div>
  );
}
