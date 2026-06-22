import React, { useEffect, useState } from 'react';
import { NavLink, Routes, Route } from 'react-router-dom';
import Today from './pages/Today.jsx';
import Roadmap from './pages/Roadmap.jsx';
import Questions from './pages/Questions.jsx';
import Speaking from './pages/Speaking.jsx';
import Progress from './pages/Progress.jsx';
import Applications from './pages/Applications.jsx';
import { api } from './api.js';

const tabs = [
  ['/', 'Today'],
  ['/roadmap', 'Roadmap'],
  ['/questions', 'Questions'],
  ['/speaking', 'Speaking'],
  ['/applications', 'Applications'],
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
          const message = health.config?.databaseConfigured
            ? `Database configured but not reachable: ${health.config.databaseError || 'check Supabase credentials.'}`
            : 'Database setup needed: add DATABASE_URL or Supabase service credentials in server/.env.';
          setState({ status: 'warn', message });
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
  const [theme, setTheme] = useState(() => {
    const saved = localStorage.getItem('mentor-theme');
    if (saved === 'light' || saved === 'dark') return saved;
    return window.matchMedia?.('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
  });

  useEffect(() => {
    document.body.dataset.theme = theme;
    localStorage.setItem('mentor-theme', theme);
  }, [theme]);

  function toggleTheme() {
    setTheme(t => t === 'dark' ? 'light' : 'dark');
  }

  const navItems = tabs.map(([to, label]) => (
    <NavLink key={to} to={to} end={to === '/'} className={({ isActive }) => isActive ? 'active' : ''}>
      {label}
    </NavLink>
  ));

  return (
    <div className="app-shell">

      {/* ── Sidebar (desktop) ── */}
      <aside className="sidebar">
        <div className="sidebar-inner">
          <div className="sidebar-brand">
            <span className="lamp" />
            <div>
              <span className="sidebar-brand-name">Mentor</span>
              <span className="sidebar-brand-sub">interview prep</span>
            </div>
          </div>
          <nav className="sidebar-nav">
            {navItems}
          </nav>
        </div>
        <div className="sidebar-footer">
          <button
            className="theme-toggle"
            type="button"
            aria-pressed={theme === 'light'}
            onClick={toggleTheme}
          >
            {theme === 'dark' ? 'Light mode' : 'Dark mode'}
          </button>
        </div>
      </aside>

      {/* ── Mobile header ── */}
      <header className="mobile-header">
        <div className="mobile-brand">
          <span className="lamp" />
          <b>Mentor</b>
        </div>
        <button
          className="theme-toggle"
          type="button"
          aria-pressed={theme === 'light'}
          onClick={toggleTheme}
        >
          {theme === 'dark' ? 'Bright' : 'Dark'}
        </button>
      </header>

      {/* ── Mobile nav ── */}
      <nav className="mobile-tabs">
        {navItems}
      </nav>

      {/* ── Main content ── */}
      <main className="main-area">
        <div className="content-wrap">
          <SetupStatus />
          <Routes>
            <Route path="/" element={<Today />} />
            <Route path="/roadmap" element={<Roadmap />} />
            <Route path="/questions" element={<Questions />} />
            <Route path="/speaking" element={<Speaking />} />
            <Route path="/applications" element={<Applications />} />
            <Route path="/progress" element={<Progress />} />
          </Routes>
        </div>
      </main>

    </div>
  );
}
