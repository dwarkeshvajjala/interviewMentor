const BASE = import.meta.env.VITE_API_URL || 'http://127.0.0.1:4000';
const PASSCODE = import.meta.env.VITE_APP_PASSCODE || '';

async function req(path, { method = 'GET', body } = {}) {
  let res;
  try {
    res = await fetch(BASE + path, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'x-app-passcode': PASSCODE
      },
      body: body ? JSON.stringify(body) : undefined
    });
  } catch (e) {
    console.error('[api] backend request failed', e);
    throw new Error(`Could not reach the backend at ${BASE}. Start the server and check VITE_API_URL.`);
  }

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const message = data.error || `Request failed (${res.status})`;
    console.error('[api] request failed', { path, status: res.status, message });
    throw new Error(message);
  }
  return data;
}

export const api = {
  health: () => req('/api/health'),

  // today
  getToday: (date) => req('/api/today' + (date ? `?date=${date}` : '')),
  toggleTask: (id) => req(`/api/task/${id}/toggle`, { method: 'POST' }),
  setMode: (date, mode) => req('/api/day/mode', { method: 'POST', body: { date, mode } }),
  saveLog: (body) => req('/api/log', { method: 'POST', body }),
  setStatus: (date, status) => req('/api/day/status', { method: 'POST', body: { date, status } }),

  // ai
  replan: (body) => req('/api/ai/replan', { method: 'POST', body }),
  sendNote: (body) => req('/api/ai/note', { method: 'POST', body }),
  getNotes: () => req('/api/ai/notes'),
  reviewAnswer: (body) => req('/api/ai/answer-review', { method: 'POST', body }),
  resourceScout: (body) => req('/api/ai/resource-scout', { method: 'POST', body }),
  mock: (body) => req('/api/ai/mock', { method: 'POST', body }),

  // data
  roadmap: () => req('/api/roadmap'),
  progress: () => req('/api/progress'),
  list: (table) => req(`/api/${table}`),
  create: (table, body) => req(`/api/${table}`, { method: 'POST', body }),
  update: (table, id, body) => req(`/api/${table}/${id}`, { method: 'PUT', body }),
  remove: (table, id) => req(`/api/${table}/${id}`, { method: 'DELETE' })
};
