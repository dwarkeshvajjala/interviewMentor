import { Router } from 'express';
import { requireSupabase, supabase } from '../supabase.js';
import { phases, consistencyRules } from '../planner.js';
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
    let total = 0;
    const series = (days || []).map(d => {
      const p = d.status === 'skipped' || d.status === 'pending' ? 0 : (points[d.mode] || 0);
      total += p;
      return { date: d.the_date, points: p, mode: d.mode, status: d.status };
    });

    // current streak: consecutive most-recent days that were not skipped/zero
    let streak = 0;
    for (let i = series.length - 1; i >= 0; i--) {
      if (series[i].points > 0) streak++; else break;
    }

    const { count: questionsCount } = await supabase.from('questions').select('*', { count: 'exact', head: true });
    const { count: canAnswer } = await supabase.from('questions').select('*', { count: 'exact', head: true }).eq('status', 'Can Answer');
    const { count: apps } = await supabase.from('applications').select('*', { count: 'exact', head: true });

    res.json({
      totalPoints: total,
      streak,
      daysEngaged: series.filter(s => s.points > 0).length,
      series,
      questionsCount: questionsCount || 0,
      canAnswer: canAnswer || 0,
      applications: apps || 0
    });
  } catch (e) {
    res.status(500).json({ error: String(e.message || e) });
  }
});

export default router;
