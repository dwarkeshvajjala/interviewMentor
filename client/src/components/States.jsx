export function LoadingState({ children = 'Loading...' }) {
  return (
    <div className="state-card">
      <span className="spinner" aria-hidden="true" />
      <span>{children}</span>
    </div>
  );
}

export function ErrorState({ title = 'Something went wrong', message, hint, onRetry }) {
  return (
    <div className="card state-panel">
      <div className="error-title">{title}</div>
      {message && <p className="muted">{message}</p>}
      {hint && <p className="faint">{hint}</p>}
      {onRetry && (
        <div className="error-actions">
          <button className="btn sm" onClick={onRetry}>Retry</button>
        </div>
      )}
    </div>
  );
}

export function InlineNotice({ tone = 'info', children }) {
  return <div className={`notice ${tone}`}>{children}</div>;
}

export function EmptyState({ title, message, action }) {
  return (
    <div className="empty-state">
      <div className="empty-title">{title}</div>
      {message && <p className="faint">{message}</p>}
      {action}
    </div>
  );
}
