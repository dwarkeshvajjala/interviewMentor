import React, { useEffect, useState } from 'react';
import { api } from '../api.js';
import { ErrorState, LoadingState } from '../components/States.jsx';

const dayClass = (s) => {
  if (!s || s.status === 'missed' || s.status === 'skipped') return 'missed';
  if (s.status === 'pending') return 'pending';
  if (s.status === 'rest') return 'rest';
  return s.mode || 'normal';
};

const dateKey = (date) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

function ProgressCalendar({ series }) {
  const map = new Map((series || []).map(s => [s.date, s]));
  const anchor = series?.length ? new Date(series[series.length - 1].date + 'T00:00:00') : new Date();
  const monthStart = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
  const monthEnd = new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0);
  const cells = [];

  for (let i = 0; i < monthStart.getDay(); i++) cells.push(null);
  for (let d = 1; d <= monthEnd.getDate(); d++) {
    const date = new Date(anchor.getFullYear(), anchor.getMonth(), d);
    const key = dateKey(date);
    cells.push({ key, day: d, record: map.get(key) });
  }

  const label = anchor.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });

  return (
    <div className="calendar-card">
      <div className="label-row">
        <h3>{label}</h3>
        <span className="faint">hover days for details</span>
      </div>
      <div className="calendar-weekdays">
        {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => <span key={`${d}-${i}`}>{d}</span>)}
      </div>
      <div className="calendar-grid">
        {cells.map((cell, i) => cell ? (
          <div
            key={cell.key}
            className={`calendar-day ${dayClass(cell.record)}`}
            title={cell.record ? `${cell.key}: ${cell.record.status} (${cell.record.points} pts)` : `${cell.key}: not started`}
          >
            <span>{cell.day}</span>
          </div>
        ) : <div key={`blank-${i}`} className="calendar-day blank" />)}
      </div>
      <div className="legend">
        <span><i className="swatch full" />full</span>
        <span><i className="swatch normal" />normal</span>
        <span><i className="swatch low" />low</span>
        <span><i className="swatch rest" />rest</span>
        <span><i className="swatch missed" />missed</span>
      </div>
    </div>
  );
}

export default function Progress() {
  const [p, setP] = useState(null);
  const [err, setErr] = useState('');

  async function load() {
    try {
      setErr('');
      setP(await api.progress());
    } catch (e) {
      setErr(e.message);
    }
  }
  useEffect(() => { load(); }, []);

  if (err) {
    return (
      <ErrorState
        title="Progress needs the database"
        message={err}
        hint="Progress is calculated from your database days, tasks, and question bank."
        onRetry={load}
      />
    );
  }
  if (!p) return <LoadingState>Loading progress...</LoadingState>;

  const recent = (p.series || []).slice(-28);
  const maxPts = 3;

  return (
    <div className="fade-in">
      <h2 className="section-title">Progress</h2>

      <div className="card" style={{ marginBottom: 14 }}>
        <div className="label-row"><h3>Last weeks</h3><span className="faint">amber = full - green = normal - dim = low</span></div>
        {recent.length === 0
          ? <p className="muted">No days logged yet. Close your first day on the Today tab.</p>
          : <div className="bars">
              {recent.map((s, i) => (
                <div key={i} className={`bar ${s.points > 0 ? dayClass(s) : 'missed'}`}
                  style={{ height: `${Math.max(s.points / maxPts * 100, 4)}%` }}
                  title={`${s.date}: ${s.status} (${s.points} pts)`} />
              ))}
            </div>}
      </div>

      <ProgressCalendar series={p.series || []} />

      <div className="stat-grid">
        <div className="stat"><div className="n" style={{ color: 'var(--sage)' }}>{p.streak}</div><div className="k">current chain (days)</div></div>
        <div className="stat"><div className="n" style={{ color: 'var(--amber)' }}>{p.totalPoints}</div><div className="k">total points</div></div>
        <div className="stat"><div className="n">{p.daysEngaged}</div><div className="k">days kept alive</div></div>
        <div className="stat"><div className="n">{p.missedDays || 0}</div><div className="k">missed / skipped days</div></div>
        <div className="stat"><div className="n">{p.canAnswer}/{p.questionsCount}</div><div className="k">questions you can answer</div></div>
      </div>

      <div className="card" style={{ marginTop: 14 }}>
        <p className="muted" style={{ margin: 0 }}>Weekly target: 8 points minimum, 12 good, 16+ excellent. Full day = 3, normal = 2, low = 1. Uneven days are fine. Disappearing for many days is the only real failure.</p>
      </div>

    </div>
  );
}
