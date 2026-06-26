import { Router } from 'express';
import { requireSupabase, supabase } from '../supabase.js';
import { modes, planForDate, todayDate } from '../planner.js';
import { answerReview, replanDay, noteFeedback, generateMock, resourceScout } from '../groq.js';

const router = Router();

function formatNoteFeedback(fb) {
  if (!fb || fb.error) return null;
  const parts = [];

  if (fb.feedback) parts.push(String(fb.feedback).trim());
  if (fb.clean_note) parts.push(`Cleaner version:\n${String(fb.clean_note).trim()}`);

  if (Array.isArray(fb.examples) && fb.examples.length) {
    parts.push(`Examples:\n${fb.examples.slice(0, 3).map(x => `- ${String(x).trim()}`).join('\n')}`);
  }

  if (Array.isArray(fb.fixes) && fb.fixes.length) {
    parts.push(`Quick fixes:\n${fb.fixes.slice(0, 3).map(x => `- ${String(x).trim()}`).join('\n')}`);
  }

  return parts.filter(Boolean).join('\n\n') || null;
}

function confidenceLabel(value) {
  const v = String(value || '').toLowerCase();
  if (v.includes('strong')) return '💪 Strong';
  if (v.includes('weak')) return '⚠️ Weak';
  return '🤔 Medium';
}

function formatAnswerMistake(review) {
  if (!review || review.error) return null;
  const parts = [];
  if (review.summary) parts.push(String(review.summary).trim());

  if (Array.isArray(review.gaps) && review.gaps.length) {
    parts.push(`Gaps:\n${review.gaps.slice(0, 3).map(x => `- ${String(x).trim()}`).join('\n')}`);
  }

  if (review.next_rep) parts.push(`Next rep: ${String(review.next_rep).trim()}`);
  return parts.filter(Boolean).join('\n\n') || null;
}

const RESOURCE_BANK = {
  csharp: [
    ['Reference', 'Microsoft Learn: C# documentation', 'https://learn.microsoft.com/en-us/dotnet/csharp/'],
    ['Practice', 'Exercism C# track', 'https://exercism.org/tracks/csharp']
  ],
  sql: [
    ['Reference', 'Microsoft Learn: Get started querying with Transact-SQL', 'https://learn.microsoft.com/en-us/training/paths/get-started-querying-with-transact-sql/'],
    ['Practice', 'SQLBolt interactive lessons', 'https://sqlbolt.com/']
  ],
  dotnet: [
    ['Reference', 'Microsoft Learn: ASP.NET Core documentation', 'https://learn.microsoft.com/en-us/aspnet/core/'],
    ['Tutorial', 'Microsoft Learn: Build web APIs with ASP.NET Core', 'https://learn.microsoft.com/en-us/training/modules/build-web-api-aspnet-core/']
  ],
  javascript: [
    ['Reference', 'MDN: JavaScript guide', 'https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide'],
    ['Practice', 'freeCodeCamp JavaScript curriculum', 'https://www.freecodecamp.org/learn/javascript-algorithms-and-data-structures-v8/']
  ],
  react: [
    ['Reference', 'React docs: Learn React', 'https://react.dev/learn'],
    ['Reference', 'React docs: Hooks', 'https://react.dev/reference/react/hooks']
  ],
  angular: [
    ['Reference', 'Angular docs: Tutorial', 'https://angular.dev/tutorials'],
    ['Reference', 'Angular docs: Essentials', 'https://angular.dev/essentials']
  ],
  azure: [
    ['Reference', 'Microsoft Learn: Azure fundamentals', 'https://learn.microsoft.com/en-us/training/paths/azure-fundamentals/'],
    ['Reference', 'Microsoft Learn: Azure App Service', 'https://learn.microsoft.com/en-us/azure/app-service/']
  ],
  dsa: [
    ['Practice', 'NeetCode practice roadmap', 'https://neetcode.io/practice'],
    ['Visual', 'VisuAlgo data structures and algorithms', 'https://visualgo.net/en']
  ],
  systemdesign: [
    ['Reference', 'System Design Primer', 'https://github.com/donnemartin/system-design-primer'],
    ['Reference', 'Azure Architecture Center', 'https://learn.microsoft.com/en-us/azure/architecture/']
  ],
  default: [
    ['Reference', 'Microsoft Learn search', 'https://learn.microsoft.com/en-us/search/'],
    ['Practice', 'freeCodeCamp learning paths', 'https://www.freecodecamp.org/learn/']
  ]
};

function resourceKeyFromText(text) {
  const value = String(text || '').toLowerCase();
  if (value.includes('sql') || value.includes('join') || value.includes('query')) return 'sql';
  if (value.includes('c#') || value.includes('csharp') || value.includes('linq')) return 'csharp';
  if (value.includes('.net') || value.includes('asp.net') || value.includes('api') || value.includes('ef core')) return 'dotnet';
  if (value.includes('react')) return 'react';
  if (value.includes('angular')) return 'angular';
  if (value.includes('javascript') || value.includes('promise') || value.includes('async')) return 'javascript';
  if (value.includes('azure') || value.includes('function') || value.includes('app service')) return 'azure';
  if (value.includes('dsa') || value.includes('array') || value.includes('string') || value.includes('two pointer')) return 'dsa';
  if (value.includes('system design') || value.includes('design')) return 'systemdesign';
  return 'default';
}

function fallbackScoutFor(day, tasks) {
  const first = tasks?.[0] || {};
  const text = `${day?.focus || ''} ${first.title || ''} ${first.detail || ''}`;
  const key = resourceKeyFromText(text);
  return {
    topic: first.title || day?.focus || 'today topic',
    query: `${key === 'default' ? (first.title || 'interview prep') : key} tutorial interview prep`,
    reason: 'Low energy is fine. Open one useful resource and let momentum warm up.',
    tiny_action: 'Open one link, read or watch for five minutes, then return to one card.'
  };
}

function buildResourceLinks(scout, tasks) {
  const taskText = `${scout?.topic || ''} ${scout?.query || ''} ${(tasks || []).map(t => `${t.title} ${t.detail}`).join(' ')}`;
  const key = resourceKeyFromText(taskText);
  const query = encodeURIComponent(String(scout?.query || scout?.topic || 'interview prep').trim());
  const trusted = (RESOURCE_BANK[key] || RESOURCE_BANK.default).map(([kind, title, url]) => ({ kind, title, url }));

  return [
    ...trusted,
    {
      kind: 'Video',
      title: `YouTube search: ${scout?.query || scout?.topic || 'current topic'}`,
      url: `https://www.youtube.com/results?search_query=${query}`
    },
    {
      kind: 'Blog',
      title: `freeCodeCamp articles: ${scout?.query || scout?.topic || 'current topic'}`,
      url: `https://www.freecodecamp.org/news/search/?query=${query}`
    },
    {
      kind: 'Community',
      title: `DEV posts: ${scout?.query || scout?.topic || 'current topic'}`,
      url: `https://dev.to/search?q=${query}`
    }
  ].slice(0, 5);
}

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

    const nextMode = Object.prototype.hasOwnProperty.call(modes, out.plan?.mode) ? out.plan.mode : day.mode;
    const { error: deleteErr } = await supabase.from('tasks').delete().eq('day_id', day.id);
    if (deleteErr) throw deleteErr;
    const { error: insertErr } = await supabase.from('tasks').insert(clean);
    if (insertErr) throw insertErr;
    const { error: dayErr } = await supabase.from('days').update({ was_replanned: true, mode: nextMode }).eq('id', day.id);
    if (dayErr) throw dayErr;

    const { data: tasks } = await supabase.from('tasks').select('*').eq('day_id', day.id).order('position');
    res.json({ message: out.plan.message || 'Re-planned for today.', mode: nextMode, tasks });
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
      ai_feedback: formatNoteFeedback(fb),
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

// Review an interview-bank answer and save the useful parts on the question row.
router.post('/answer-review', requireSupabase, async (req, res) => {
  try {
    const { id, topic, question, my_answer, senior_answer } = req.body;
    if (!question || !String(question).trim()) return res.status(400).json({ error: 'Question is required.' });
    if (!my_answer || !String(my_answer).trim()) return res.status(400).json({ error: 'Write your answer first, then ask for review.' });

    const review = await answerReview({
      topic,
      question,
      myAnswer: my_answer,
      seniorAnswer: senior_answer
    });
    if (review.error) return res.status(502).json(review);

    const update = {
      my_answer,
      senior_answer: senior_answer || null,
      mistake: formatAnswerMistake(review),
      confidence: confidenceLabel(review.confidence),
      last_practiced: todayDate()
    };

    let item = null;
    if (id) {
      const { data, error } = await supabase.from('questions').update(update).eq('id', id).select().maybeSingle();
      if (error) throw error;
      item = data;
    }

    res.json({ review, item });
  } catch (e) {
    res.status(500).json({ error: String(e.message || e) });
  }
});

// Suggest real resource places when the learner is bored or stuck.
router.post('/resource-scout', requireSupabase, async (req, res) => {
  try {
    const dateStr = req.body.date || todayDate();
    const { data: day } = await supabase.from('days').select('*').eq('the_date', dateStr).maybeSingle();
    if (!day) return res.status(400).json({ error: 'Load today first.' });

    const { data: tasks } = await supabase
      .from('tasks')
      .select('kind,title,detail,resource_url,minutes,done,position')
      .eq('day_id', day.id)
      .order('position');

    const activeTasks = (tasks || []).filter(t => !t.done);
    const scoutInput = {
      weekLabel: day.week_label,
      focus: day.focus,
      tasks: activeTasks.length ? activeTasks : (tasks || [])
    };
    const aiScout = await resourceScout(scoutInput);
    const scout = aiScout.error ? fallbackScoutFor(day, scoutInput.tasks) : {
      topic: String(aiScout.topic || scoutInput.tasks?.[0]?.title || day.focus || 'today topic').slice(0, 120),
      query: String(aiScout.query || aiScout.topic || scoutInput.tasks?.[0]?.title || 'interview prep').slice(0, 160),
      reason: String(aiScout.reason || 'Open one useful resource and return to one card.').slice(0, 300),
      tiny_action: String(aiScout.tiny_action || 'Open one link for five minutes, then mark one tiny note.').slice(0, 240)
    };

    res.json({
      scout,
      resources: buildResourceLinks(scout, scoutInput.tasks),
      aiError: aiScout.error || null,
      sourceNote: 'AI picks the topic. Links are trusted docs or real search pages, not invented article URLs.'
    });
  } catch (e) {
    res.status(500).json({ error: String(e.message || e) });
  }
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
