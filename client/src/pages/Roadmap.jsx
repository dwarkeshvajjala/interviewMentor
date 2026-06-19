import { useEffect, useState } from 'react';
import { api } from '../api.js';
import { ErrorState, LoadingState } from '../components/States.jsx';

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

      <div className="card" style={{ marginBottom: 14 }}>
        <div className="eyebrow">Days 1-14</div>
        <p className="muted" style={{ marginTop: 6 }}>Rehabilitation. Restart your hands and your voice - C# basics, SQL basics, JS basics, first mock. Do not judge yourself in these two weeks.</p>
      </div>

      {data.phases.map(p => (
        <div key={p.week} className="list-item">
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
