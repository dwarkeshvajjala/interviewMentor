import { Router } from 'express';
import { requireSupabase, supabase } from '../supabase.js';
import { planForDate, todayDate, modes } from '../planner.js';
import { syncDailyLog } from '../notion.js';

const router = Router();
router.use(requireSupabase);

// Ensure a day row + its tasks exist in the DB for the given date.
// Written to be safe against two requests arriving at once (e.g. React
// StrictMode double-mounting in dev), which would otherwise hit the unique
// constraint on days.the_date and/or duplicate tasks.
async function ensureDay(dateStr) {
  const plan = planForDate(dateStr);
  let { data: day } = await supabase.from('days').select('*').eq('the_date', dateStr).maybeSingle();

  if (!day) {
    const insert = {
      day_index: plan.dayIndex,
      the_date: dateStr,
      week_label: plan.weekLabel,
      phase: plan.phase,
      focus: plan.focus,
      mode: plan.defaultMode || 'normal',
      status: 'pending'
    };
    const { data: created, error: insErr } = await supabase.from('days').insert(insert).select().maybeSingle();

    if (insErr || !created) {
      // Most likely a concurrent request already created this day. Re-fetch it.
      const again = await supabase.from('days').select('*').eq('the_date', dateStr).maybeSingle();
      day = again.data;
      if (!day) throw insErr || new Error('Could not create or load the day');
    } else {
      day = created;
      // Only the request that actually created the day seeds its tasks,
      // so concurrent loads can never produce duplicate tasks.
      if (plan.tasks?.length) {
        const { data: previousDays } = await supabase
          .from('days')
          .select('id, the_date, status')
          .lt('the_date', dateStr)
          .order('the_date', { ascending: false })
          .limit(1);
        const previous = previousDays?.[0];
        let carried = [];

        if (previous && previous.status !== 'rest') {
          const { data: previousTasks } = await supabase
            .from('tasks')
            .select('kind, title, detail, resource_url, minutes, done, position')
            .eq('day_id', previous.id)
            .eq('done', false)
            .order('position');
          carried = (previousTasks || []).slice(0, 3).map(t => ({
            kind: t.kind,
            title: t.title,
            detail: `Carried over from ${previous.the_date}. ${t.detail || ''}`.trim(),
            resource_url: t.resource_url || '',
            minutes: t.minutes || null
          }));
        }

        const seedTasks = carried.length >= 3
          ? carried
          : [...carried, ...plan.tasks].slice(0, 3);
        const rows = seedTasks.map((t, i) => ({
          day_id: day.id, kind: t.kind, title: t.title, detail: t.detail,
          resource_url: t.resource_url || '', minutes: t.minutes || null, position: i
        }));
        await supabase.from('tasks').insert(rows);
      }
    }
  }

  const { data: tasks } = await supabase.from('tasks').select('*').eq('day_id', day.id).order('position');
  const { data: log } = await supabase.from('logs').select('*').eq('the_date', dateStr).maybeSingle();
  return { day, tasks: tasks || [], log: log || null, plan };
}

router.get('/today', async (req, res) => {
  try {
    const dateStr = req.query.date || todayDate();
    const result = await ensureDay(dateStr);
    res.json({ ...result, modes });
  } catch (e) {
    res.status(500).json({ error: String(e.message || e) });
  }
});

// Toggle a single task done/undone.
router.post('/task/:id/toggle', async (req, res) => {
  try {
    const id = req.params.id;
    const { data: t } = await supabase.from('tasks').select('done').eq('id', id).maybeSingle();
    if (!t) return res.status(404).json({ error: 'Task not found' });
    const next = !t.done;
    const { data, error } = await supabase.from('tasks')
      .update({ done: next, done_at: next ? new Date().toISOString() : null })
      .eq('id', id).select().maybeSingle();
    if (error) throw error;
    res.json({ task: data });
  } catch (e) {
    res.status(500).json({ error: String(e.message || e) });
  }
});

// Set the day's mode (full/normal/low).
router.post('/day/mode', async (req, res) => {
  try {
    const { date, mode } = req.body;
    const { error } = await supabase.from('days').update({ mode }).eq('the_date', date || todayDate());
    if (error) throw error;
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: String(e.message || e) });
  }
});

// Save the daily check-in log (upsert by date).
router.post('/log', async (req, res) => {
  try {
    const dateStr = req.body.date || todayDate();
    const row = { the_date: dateStr };
    if (Object.prototype.hasOwnProperty.call(req.body, 'energy')) row.energy = req.body.energy ?? null;
    if (Object.prototype.hasOwnProperty.call(req.body, 'mood')) row.mood = req.body.mood ?? null;
    if (Object.prototype.hasOwnProperty.call(req.body, 'what_felt_hard')) {
      row.what_felt_hard = req.body.what_felt_hard?.trim() || null;
    }
    if (Object.prototype.hasOwnProperty.call(req.body, 'what_avoided')) {
      row.what_avoided = req.body.what_avoided?.trim() || null;
    }
    if (Object.prototype.hasOwnProperty.call(req.body, 'minutes_tomorrow')) {
      row.minutes_tomorrow = req.body.minutes_tomorrow ?? null;
    }
    const { data, error } = await supabase.from('logs').upsert(row, { onConflict: 'the_date' }).select().single();
    if (error) throw error;
    res.json({ log: data });
  } catch (e) {
    res.status(500).json({ error: String(e.message || e) });
  }
});

// Mark the day's status (done / rest / skipped) and sync a summary to Notion.
router.post('/day/status', async (req, res) => {
  const mode_to_mins = { full: 120, normal: 90, low: 20 };
  try {
    const dateStr = req.body.date || todayDate();
    const status = req.body.status || 'done';
    const { data: existing } = await supabase.from('days').select('*').eq('the_date', dateStr).maybeSingle();
    if (!existing) return res.status(404).json({ error: 'No day to update yet. Open Today first.' });

    const { data: existingTasks } = await supabase.from('tasks').select('done').eq('day_id', existing.id);
    const doneBeforeClose = (existingTasks || []).filter(t => t.done).length;
    if (status === 'done' && doneBeforeClose === 0) {
      return res.status(400).json({ error: 'Move at least one task card to Done before closing the day.' });
    }

    const { data: day, error } = await supabase.from('days').update({ status }).eq('the_date', dateStr).select().maybeSingle();
    if (error) throw error;
    if (!day) return res.status(404).json({ error: 'No day to update yet. Open Today first.' });

    const tasks = existingTasks || [];
    const { data: log } = await supabase.from('logs').select('*').eq('the_date', dateStr).maybeSingle();
    const doneCount = tasks.filter(t => t.done).length;
    const summary = `${doneCount}/${(tasks || []).length} tasks done. ${day.phase || ''}`.trim();

    // Fire-and-forget Notion sync (does nothing if Notion not configured).
    const durationMins = mode_to_mins[day.mode] ?? null;
    syncDailyLog({
      the_date: dateStr, mode: day.mode, status,
      energy: log?.energy, mood: log?.mood, summary,
      week_label: day.week_label,
      duration_minutes: durationMins
    }).catch(() => {});

    res.json({ day, synced: !!process.env.NOTION_DAILY_DB_ID });
  } catch (e) {
    res.status(500).json({ error: String(e.message || e) });
  }
});

export default router;
