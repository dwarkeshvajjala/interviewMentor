import { Router } from 'express';
import { requireSupabase, supabase } from '../supabase.js';
import { planForDate, todayDate } from '../planner.js';
import { replanDay, noteFeedback, generateMock } from '../groq.js';

const router = Router();

// Re-plan today's tasks with AI, then REPLACE today's tasks in the DB.
router.post('/replan', requireSupabase, async (req, res) => {
  try {
    const dateStr = req.body.date || todayDate();
    const { energy, mood, minutes, recentNote } = req.body;

    const { data: day } = await supabase.from('days').select('*').eq('the_date', dateStr).maybeSingle();
    if (!day) return res.status(400).json({ error: 'Load today first.' });

    const plan = { weekLabel: day.week_label, focus: day.focus, tasks: (await supabase.from('tasks').select('kind,title,detail,minutes').eq('day_id', day.id)).data || [] };

    const out = await replanDay({ plan, energy, mood, minutes, recentNote });
    if (out.error) return res.status(502).json(out);

    // Sanitize whatever the model returned before it ever touches the DB.
    const ALLOWED = ['code', 'learn', 'speak'];
    const clean = (out.plan?.tasks || [])
      .filter(t => t && t.title && String(t.title).trim())
      .slice(0, 6)
      .map((t, i) => ({
        day_id: day.id,
        kind: ALLOWED.includes(t.kind) ? t.kind : 'learn',
        title: String(t.title).slice(0, 300),
        detail: t.detail ? String(t.detail).slice(0, 1500) : '',
        minutes: Number.isFinite(Number(t.minutes)) ? Number(t.minutes) : null,
        position: i,
        resource_url: ''
      }));

    // If the AI gave nothing usable, keep the original plan instead of wiping it.
    if (clean.length === 0) {
      const { data: kept } = await supabase.from('tasks').select('*').eq('day_id', day.id).order('position');
      return res.json({ message: "Kept your original plan — the AI didn't return usable tasks. Try again in a moment.", mode: day.mode, tasks: kept || [] });
    }

    await supabase.from('tasks').delete().eq('day_id', day.id);
    await supabase.from('tasks').insert(clean);
    await supabase.from('days').update({ was_replanned: true, mode: out.plan.mode || day.mode }).eq('id', day.id);

    const { data: tasks } = await supabase.from('tasks').select('*').eq('day_id', day.id).order('position');
    res.json({ message: out.plan.message || 'Re-planned for today.', mode: out.plan.mode || day.mode, tasks });
  } catch (e) {
    res.status(500).json({ error: String(e.message || e) });
  }
});

// Submit a learning note, get AI feedback, save it.
router.post('/note', requireSupabase, async (req, res) => {
  try {
    const { topic, content } = req.body;
    if (!content || !content.trim()) return res.status(400).json({ error: 'Empty note.' });

    const fb = await noteFeedback({ topic, content });
    const row = {
      topic: topic || null,
      content,
      ai_feedback: fb.error ? null : (fb.feedback || null),
      follow_up: fb.follow_up || null,
      restudy_flag: !!fb.restudy
    };
    const { data, error } = await supabase.from('notes').insert(row).select().single();
    if (error) throw error;
    res.json({ note: data, aiError: fb.error || null });
  } catch (e) {
    res.status(500).json({ error: String(e.message || e) });
  }
});

router.get('/notes', requireSupabase, async (req, res) => {
  const { data } = await supabase.from('notes').select('*').order('created_at', { ascending: false }).limit(30);
  res.json({ notes: data || [] });
});

// Generate a short mock for the current phase.
router.post('/mock', async (req, res) => {
  try {
    const dateStr = req.body.date || todayDate();
    const plan = planForDate(dateStr);
    const out = await generateMock({ phase: plan.phase });
    if (out.error) return res.status(502).json(out);
    res.json(out);
  } catch (e) {
    res.status(500).json({ error: String(e.message || e) });
  }
});

export default router;
