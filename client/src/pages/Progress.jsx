import React, { useEffect, useState } from 'react';
import { api } from '../api.js';
import { ErrorState, LoadingState } from '../components/States.jsx';

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
        hint="Progress is calculated from your database days, tasks, questions, and applications."
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
                <div key={i} className={`bar ${s.points > 0 ? s.mode : ''}`}
                  style={{ height: `${Math.max(s.points / maxPts * 100, 4)}%` }}
                  title={`${s.date}: ${s.status} (${s.points} pts)`} />
              ))}
            </div>}
      </div>

      <div className="stat-grid">
        <div className="stat"><div className="n" style={{ color: 'var(--sage)' }}>{p.streak}</div><div className="k">current chain (days)</div></div>
        <div className="stat"><div className="n" style={{ color: 'var(--amber)' }}>{p.totalPoints}</div><div className="k">total points</div></div>
        <div className="stat"><div className="n">{p.daysEngaged}</div><div className="k">days kept alive</div></div>
        <div className="stat"><div className="n">{p.canAnswer}/{p.questionsCount}</div><div className="k">questions you can answer</div></div>
      </div>

      <div className="card" style={{ marginTop: 14 }}>
        <p className="muted" style={{ margin: 0 }}>Weekly target: 8 points minimum, 12 good, 16+ excellent. Full day = 3, normal = 2, low = 1. Uneven days are fine. Disappearing for many days is the only real failure.</p>
      </div>

      <div className="card" style={{ marginTop: 14 }}>
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <span className="muted">Applications in flight</span>
          <b style={{ fontFamily: 'var(--display)', fontSize: 18 }}>{p.applications}</b>
        </div>
      </div>
    </div>
  );
}
