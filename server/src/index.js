import express from 'express';
import cors from 'cors';
import 'dotenv/config';

import todayRoutes from './routes/today.js';
import aiRoutes from './routes/ai.js';
import dataRoutes from './routes/data.js';
import { roadmapMeta } from './planner.js';
import { hasSupabaseConfig } from './supabase.js';

const app = express();
app.use(express.json({ limit: '1mb' }));
const allowedOrigins = (process.env.CLIENT_ORIGIN || 'http://localhost:5173,http://127.0.0.1:5173')
  .split(',')
  .map(origin => origin.trim())
  .filter(Boolean);
app.use(cors({
  origin(origin, callback) {
    if (!origin || allowedOrigins.includes('*') || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    return callback(null, false);
  }
}));

// Simple shared-secret guard. Frontend sends `x-app-passcode`.
// Set APP_PASSCODE in .env. Leave it unset only for pure local testing.
app.use((req, res, next) => {
  if (req.method === 'OPTIONS') return next();   // CORS preflight
  if (req.path === '/api/health') return next();
  const need = process.env.APP_PASSCODE;
  if (!need) return next();
  if (req.get('x-app-passcode') === need) return next();
  return res.status(401).json({ error: 'Unauthorized' });
});

app.get('/api/health', (req, res) => res.json({
  ok: true,
  plan: roadmapMeta.title,
  config: {
    database: hasSupabaseConfig,
    ai: Boolean(process.env.GROQ_API_KEY),
    passcode: Boolean(process.env.APP_PASSCODE)
  }
}));

app.use('/api', todayRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api', dataRoutes);

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`Interview Mentor API running on http://localhost:${PORT}`);
  if (!hasSupabaseConfig) console.log('  ! Set DATABASE_URL, or SUPABASE_URL / SUPABASE_SERVICE_KEY, in server/.env');
  if (!process.env.GROQ_API_KEY) console.log('  ! Set GROQ_API_KEY in server/.env for AI features');
  if (!process.env.APP_PASSCODE) console.log('  ! APP_PASSCODE is empty — API is open. Set one before deploying.');
});
