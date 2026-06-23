import React, { useCallback, useEffect, useState } from 'react';
import { api } from '../api.js';
import { ErrorState, LoadingState } from '../components/States.jsx';
import { useSpeechInput } from '../useSpeechInput.js';

function formatNoteDate(value) {
  if (!value) return 'Today';
  return new Date(value).toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric'
  });
}

function NoteCard({ note }) {
  return (
    <article className="note-card">
      <div className="note-card-head">
        <div>
          <span className="eyebrow">{formatNoteDate(note.created_at || note.the_date)}</span>
          <h3>{note.topic || 'Untitled note'}</h3>
        </div>
        {note.restudy_flag && <span className="pill restudy">Restudy</span>}
      </div>
      <div className="raw-note">{note.content}</div>
      {note.ai_feedback ? (
        <div className="feedback-box">
          <div className="who">Coach feedback</div>
          <div className="ai-text">{note.ai_feedback}</div>
          {note.follow_up && <div className="follow">Test yourself: {note.follow_up}</div>}
        </div>
      ) : (
        <p className="muted">Raw note saved. AI feedback was unavailable for this one.</p>
      )}
    </article>
  );
}

export default function Notes() {
  const [notes, setNotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [topic, setTopic] = useState('');
  const [content, setContent] = useState('');
  const [busy, setBusy] = useState(false);
  const [savedNote, setSavedNote] = useState(null);

  const appendDictation = useCallback((text) => {
    setContent(prev => `${prev}${prev ? ' ' : ''}${text}`);
  }, []);
  const speech = useSpeechInput(appendDictation);

  async function load() {
    try {
      setErr('');
      setLoading(true);
      const out = await api.getNotes();
      setNotes(out.notes || []);
    } catch (e) {
      setErr(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function submitNote() {
    if (!content.trim()) return;
    setBusy(true);
    setErr('');
    setSavedNote(null);
    try {
      const out = await api.sendNote({ topic, content });
      const next = out.note;
      setSavedNote(next);
      setNotes(prev => [next, ...prev.filter(n => n.id !== next.id)]);
      setContent('');
      setTopic('');
      if (out.aiError) {
        setErr('Saved your raw note. AI feedback is off right now, so the note is still safe.');
      }
    } catch (e) {
      setErr(`Could not save note: ${e.message}`);
      console.warn('[notes] save failed', e);
    } finally {
      setBusy(false);
    }
  }

  if (loading && notes.length === 0) return <LoadingState>Loading notebook...</LoadingState>;
  if (err && notes.length === 0 && !content) {
    return <ErrorState title="Notebook needs the backend" message={err} hint="Check that the backend is running and the database is connected." onRetry={load} />;
  }

  return (
    <div className="notebook-page fade-in">
      {err && (
        <div className="notice error">
          <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <span>{err}</span>
            <button className="btn sm ghost" onClick={() => setErr('')}>Dismiss</button>
          </div>
        </div>
      )}

      <section className="notebook-hero">
        <div>
          <div className="eyebrow">Learning notebook</div>
          <h1 className="day-title">Paste messy notes. Keep the original. Improve the thinking.</h1>
          <p className="focus">
            This page keeps your raw words exactly as you wrote them, then adds a cleaner version,
            examples, corrections, and one question to test the idea.
          </p>
        </div>
        <div className="hero-metrics">
          <div><b>{notes.length}</b><span>saved notes</span></div>
          <div><b>{notes.filter(n => n.restudy_flag).length}</b><span>to revisit</span></div>
        </div>
      </section>

      <div className="notebook-layout">
        <section className="notebook-composer">
          <div className="label-row">
            <h3>New note</h3>
            <span className="faint">raw language is welcome</span>
          </div>
          <input
            value={topic}
            onChange={e => setTopic(e.target.value)}
            placeholder="Topic - e.g. SQL joins, JWT auth, React state"
          />
          <textarea
            value={content}
            onChange={e => setContent(e.target.value)}
            placeholder="Paste your natural notes here. Do not worry about grammar, order, or polish."
          />
          <div className="row">
            <button className="btn primary" onClick={submitNote} disabled={busy || !content.trim()}>
              {busy ? 'Saving...' : 'Save and get feedback'}
            </button>
            {speech.supported && (
              <button className={`btn ghost ${speech.listening ? 'listening' : ''}`} onClick={speech.toggle}>
                {speech.listening ? 'Stop dictation' : 'Dictate'}
              </button>
            )}
          </div>
          <p className="faint">
            The original note stays untouched. The coach layer is only an add-on, so your thought process is never overwritten.
          </p>

          {savedNote && (
            <div className="feedback-box fresh">
              <div className="who">Saved just now</div>
              <div className="raw-note">{savedNote.content}</div>
              {savedNote.ai_feedback && <div className="ai-text">{savedNote.ai_feedback}</div>}
              {savedNote.follow_up && <div className="follow">Test yourself: {savedNote.follow_up}</div>}
            </div>
          )}
        </section>

        <aside className="notebook-side">
          <div className="rail-panel">
            <div className="label-row"><h3>How to use it</h3></div>
            <p className="muted">
              Use this like a real notebook: paste rough thoughts after a card, after a video, or after debugging.
              The AI should explain what is useful, fix unclear wording, and give examples without making your note sound fake.
            </p>
          </div>
          <div className="rail-panel">
            <div className="label-row"><h3>Good note prompt</h3></div>
            <p className="raw-note small">
              I understood this part. I got confused here. Example I tried. Where I may be wrong.
            </p>
          </div>
        </aside>
      </div>

      <section className="note-feed">
        <div className="label-row">
          <h3>Recent notes</h3>
          <button className="btn sm ghost" onClick={load} disabled={loading}>{loading ? 'Refreshing...' : 'Refresh'}</button>
        </div>
        {notes.length ? notes.map(note => <NoteCard key={note.id} note={note} />) : (
          <div className="empty-state">
            <div className="empty-title">No notes yet</div>
            <p className="muted">Your first rough note goes here. Messy is fine; useful is the point.</p>
          </div>
        )}
      </section>
    </div>
  );
}
