import { useEffect, useState } from 'react';
import { NavLink, Routes, Route } from 'react-router-dom';
import Today from './pages/Today.jsx';
import Roadmap from './pages/Roadmap.jsx';
import Questions from './pages/Questions.jsx';
import Applications from './pages/Applications.jsx';
import Speaking from './pages/Speaking.jsx';
import Progress from './pages/Progress.jsx';
import { api } from './api.js';

const tabs = [
  ['/', 'Today'],
  ['/roadmap', 'Roadmap'],
  ['/questions', 'Questions'],
  ['/applications', 'Applications'],
  ['/speaking', 'Speaking'],
  ['/progress', 'Progress']
];

function SetupStatus() {
  const [state, setState] = useState({ status: 'checking', message: 'Checking backend...' });

  useEffect(() => {
    let active = true;
    api.health()
      .then((health) => {
        if (!active) return;
        if (!health.config?.database) {
          setState({ status: 'warn', message: 'Database setup needed: add DATABASE_URL or Supabase service credentials in server/.env.' });
          return;
        }
        if (!health.config?.ai) {
          setState({ status: 'soft', message: 'Core app ready. Add GROQ_API_KEY later to enable AI coaching.' });
          return;
        }
        setState({ status: 'ok', message: 'Backend connected.' });
      })
      .catch((e) => {
        if (!active) return;
        setState({ status: 'bad', message: e.message });
      });
    return () => { active = false; };
  }, []);

  return (
    <div className={`setup-status ${state.status}`}>
      <span className="status-dot" aria-hidden="true" />
      <span>{state.message}</span>
      {state.status === 'bad' && (
        <button className="status-retry" onClick={() => window.location.reload()}>Retry</button>
      )}
    </div>
  );
}

export default function App() {
  return (
    <div className="shell">
      <div className="topbar">
        <div className="brand">
          <span className="lamp" />
          <b>Mentor</b>
          <span>your daily prep, one screen</span>
        </div>
      </div>
      <SetupStatus />

      <nav className="tabs">
        {tabs.map(([to, label]) => (
          <NavLink key={to} to={to} end={to === '/'} className={({ isActive }) => isActive ? 'active' : ''}>
            {label}
          </NavLink>
        ))}
      </nav>

      <Routes>
        <Route path="/" element={<Today />} />
        <Route path="/roadmap" element={<Roadmap />} />
        <Route path="/questions" element={<Questions />} />
        <Route path="/applications" element={<Applications />} />
        <Route path="/speaking" element={<Speaking />} />
        <Route path="/progress" element={<Progress />} />
      </Routes>
    </div>
  );
}
