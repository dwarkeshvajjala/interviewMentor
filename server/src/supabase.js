import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';
import { createPgAdapter } from './pg-adapter.js';

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_KEY;
const databaseUrl = process.env.DATABASE_URL;
export const hasSupabaseConfig = Boolean(databaseUrl || (url && key));

if (!hasSupabaseConfig) {
  console.warn('[database] Set DATABASE_URL, or set SUPABASE_URL / SUPABASE_SERVICE_KEY, in server/.env');
}

export const supabase = databaseUrl
  ? createPgAdapter(databaseUrl)
  : createClient(url || 'http://localhost', key || 'missing', {
      auth: { persistSession: false }
    });

export function requireSupabase(req, res, next) {
  if (hasSupabaseConfig) return next();
  return res.status(503).json({
    error: 'Database is not configured yet. Create server/.env from server/.env.example, then set DATABASE_URL or SUPABASE_URL and SUPABASE_SERVICE_KEY.'
  });
}
