import React, { useEffect, useState } from 'react';
import { api } from '../api.js';
import { ErrorState, LoadingState } from '../components/States.jsx';

const kickoffWeeks = [
  {
    week: 1,
    days: 'Day 1-7',
    title: 'Programming restart',
    focus: 'C# program structure, methods, arrays, strings, collections, OOP basics, and one review day.'
  },
  {
    week: 2,
    days: 'Day 8-14',
    title: 'Basics, SQL & first mock',
    focus: 'SQL SELECT/JOIN/GROUP BY, JavaScript basics, async JavaScript, API planning, and the first mock day.'
  }
];

export default function Roadmap() {
  const [data, setData] = useState(null);
  const [err, setErr] = useState('');
  async function load() {
    try {
      setErr('');
      setData(await api.roadmap());
    } catch (e) {
      setErr(e.message);
    }
  }
  useEffect(() => { load(); }, []);

  if (err) return <ErrorState title="Could not load roadmap" message={err} onRetry={load} />;
  if (!data) return <LoadingState>Loading roadmap...</LoadingState>;

  return (
    <div className="fade-in">
      <h2 className="section-title">The 90-day spine</h2>

      <div className="roadmap-intro">
        <div>
          <div className="eyebrow">First 14 days</div>
          <h3>Rebuild rhythm before intensity</h3>
          <p className="muted">The first two weeks are deliberately simple: restart your hands, rebuild speaking comfort, and avoid making missed days feel like debt.</p>
        </div>
        <span className="pill">rehab phase</span>
      </div>

      {kickoffWeeks.map(w => (
        <div key={w.week} className="list-item roadmap-week">
          <div>
            <span className="pill">{w.days}</span>
            <b>Week {w.week} - {w.title}</b>
          </div>
          <p className="muted">{w.focus}</p>
        </div>
      ))}

      {data.phases.map(p => (
        <div key={p.week} className="list-item roadmap-week">
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <b style={{ fontFamily: 'var(--display)' }}>Week {p.week} - {p.name}</b>
            <span className="pill">Day {p.startDay}-{p.endDay}</span>
          </div>
          <p className="muted" style={{ margin: '6px 0 0' }}>{p.focus}</p>
        </div>
      ))}

      <h2 className="section-title" style={{ marginTop: 26 }}>Rules before motivation</h2>
      <div className="card">
        {data.consistencyRules.map((r, i) => (
          <p key={i} className="muted" style={{ margin: i ? '10px 0 0' : 0 }}>- {r}</p>
        ))}
      </div>
    </div>
  );
}
