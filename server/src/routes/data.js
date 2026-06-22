import { Router } from 'express';
import { requireSupabase, supabase } from '../supabase.js';
import { phases, consistencyRules, planStartDate, todayDate } from '../planner.js';
import { syncQuestion, syncApplication } from '../notion.js';

const router = Router();

// ---------- generic helpers ----------
function crud(table, { syncFn } = {}) {
  const r = Router();
  r.get('/', async (req, res) => {
    const { data, error } = await supabase.from(table).select('*').order('created_at', { ascending: false });
    if (error) return res.status(500).json({ error: error.message });
    res.json({ items: data || [] });
  });
  r.post('/', async (req, res) => {
    const { data, error } = await supabase.from(table).insert(req.body).select().single();
    if (error) return res.status(500).json({ error: error.message });
    if (syncFn) syncFn(data).catch(() => {});
    res.json({ item: data });
  });
  r.put('/:id', async (req, res) => {
    const { data, error } = await supabase.from(table).update(req.body).eq('id', req.params.id).select().maybeSingle();
    if (error) return res.status(500).json({ error: error.message });
    if (!data) return res.status(404).json({ error: 'Not found' });
    res.json({ item: data });
  });
  r.delete('/:id', async (req, res) => {
    const { error } = await supabase.from(table).delete().eq('id', req.params.id);
    if (error) return res.status(500).json({ error: error.message });
    res.json({ ok: true });
  });
  return r;
}

router.use('/questions', requireSupabase, crud('questions', { syncFn: syncQuestion }));
router.use('/applications', requireSupabase, crud('applications', { syncFn: syncApplication }));
router.use('/recordings', requireSupabase, crud('recordings'));

// ---------- roadmap (read-only view) ----------
router.get('/roadmap', (req, res) => {
  res.json({ phases, consistencyRules });
});

// ---------- progress / streak ----------
router.get('/progress', requireSupabase, async (req, res) => {
  try {
    const { data: days } = await supabase.from('days').select('the_date, mode, status').order('the_date');
    const points = { full: 3, normal: 2, low: 1 };
    const today = todayDate();
    const byDate = new Map((days || []).map(d => [String(d.the_date), d]));

    function asUtcDate(dateStr) {
      const [y, m, d] = String(dateStr).split('-').map(Number);
      return new Date(Date.UTC(y, m - 1, d));
    }

    function formatDate(date) {
      return date.toISOString().slice(0, 10);
    }

    function scoreDay(day) {
      if (!day) return 0;
      if (day.status === 'rest') return 1;
      if (day.status === 'done') return points[day.mode] || 0;
      return 0;
    }

    let total = 0;
    const series = [];
    const start = asUtcDate(planStartDate);
    const end = asUtcDate(today);

    if (start <= end) {
      for (let cur = new Date(start); cur <= end; cur.setUTCDate(cur.getUTCDate() + 1)) {
        const date = formatDate(cur);
        const day = byDate.get(date);
        const p = scoreDay(day);
        const status = day?.status === 'pending' && date < today
          ? 'missed'
          : (day?.status || (date === today ? 'pending' : 'missed'));
        total += p;
        series.push({ date, points: p, mode: day?.mode || 'missed', status });
      }
    }

    // Current streak: consecutive completed/rest days. Today does not break the
    // chain while it is still pending, but older missing days do.
    let streak = 0;
    for (let i = series.length - 1; i >= 0; i--) {
      if (i === series.length - 1 && series[i].date === today && series[i].points === 0) continue;
      if (series[i].points > 0) streak++; else break;
    }

    const { count: questionsCount } = await supabase.from('questions').select('*', { count: 'exact', head: true });
    const { count: canAnswer } = await supabase.from('questions').select('*', { count: 'exact', head: true }).eq('status', 'Can Answer');
    const { count: apps } = await supabase.from('applications').select('*', { count: 'exact', head: true });
    const { data: recentLogs } = await supabase
      .from('logs')
      .select('the_date, energy, mood, what_felt_hard, what_avoided, minutes_tomorrow, created_at')
      .order('the_date', { ascending: false })
      .limit(7);

    res.json({
      totalPoints: total,
      streak,
      daysEngaged: series.filter(s => s.points > 0).length,
      missedDays: series.filter(s => s.status === 'missed' || s.status === 'skipped').length,
      series,
      questionsCount: questionsCount || 0,
      canAnswer: canAnswer || 0,
      applications: apps || 0,
      recentLogs: recentLogs || []
    });
  } catch (e) {
    res.status(500).json({ error: String(e.message || e) });
  }
});

export default router;
