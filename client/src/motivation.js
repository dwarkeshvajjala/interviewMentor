function seededIndex(key, length) {
  let hash = 0;
  for (let i = 0; i < key.length; i++) hash = ((hash << 5) - hash) + key.charCodeAt(i);
  return Math.abs(hash) % length;
}

function pickDaily(items, salt = '') {
  if (!items.length) return items[0];
  const key = `${new Date().toDateString()}-${salt}`;
  return items[seededIndex(key, items.length)];
}

export function getTimeGreeting(now = new Date(), name = 'Dwarkesh') {
  const hour = now.getHours();
  if (hour < 5) {
    return {
      title: `Still up, ${name}?`,
      label: 'late night',
      line: 'Even one small thing before bed puts you a step ahead of where you were.'
    };
  }
  if (hour < 12) {
    return {
      title: `Morning, ${name}`,
      label: 'fresh start',
      line: 'Best time of the day. Start before your brain starts negotiating.'
    };
  }
  if (hour < 17) {
    return {
      title: `Hey ${name}`,
      label: 'midday grind',
      line: 'Afternoon focus hits different. Get one good round in right now.'
    };
  }
  if (hour < 21) {
    return {
      title: `Evening, ${name}`,
      label: 'evening session',
      line: "This is the session most people skip. You didn't open this for nothing — let's go."
    };
  }
  return {
    title: `Night mode, ${name}`,
    label: 'late session',
    line: 'Night work counts. Make it short, make it real, then actually sleep.'
  };
}

const coachLines = [
  { tone: 'steady', tag: 'today', text: "Just one honest round. The day doesn't need to be perfect." },
  { tone: 'steady', tag: 'small step', text: "A quiet 20 minutes still moves the needle. You don't need momentum to start — starting creates momentum." },
  { tone: 'future', tag: 'career', text: "Every answer you practice makes the next interview feel less like a test and more like a normal conversation." },
  { tone: 'gentle', tag: 'reset', text: "Day feels off? Lower the task size, not the promise to show up." },
  { tone: 'future', tag: 'range', text: "Clearer thinking, cleaner answers, steadier delivery under pressure. That's what this actually builds." },
  { tone: 'steady', tag: 'proof', text: "You opened the app. That already separates today from the version of you that didn't." },
  { tone: 'steady', tag: 'real talk', text: "Most people wait to feel ready. The ones who get there started before they were." },
  { tone: 'future', tag: 'compound', text: "Today's session compounds quietly. You won't feel it today. You'll feel it in the interview room." },
  { tone: 'gentle', tag: 'off day', text: "Not your best day? That's fine. Show up anyway. The chain doesn't ask how you felt." },
  { tone: 'steady', tag: 'identity', text: "You're not just studying. You're building the habit of someone who shows up even when it's inconvenient." },
  { tone: 'quote', tag: 'Muhammad Ali', text: "Don't count the days. Make the days count." },
  { tone: 'quote', tag: 'Archilochus', text: "We don't rise to the level of our expectations. We fall to the level of our training." },
  { tone: 'quote', tag: 'Mark Twain', text: "The secret of getting ahead is getting started." },
  { tone: 'quote', tag: 'James Clear', text: "Every action is a vote for the type of person you want to become." },
  { tone: 'quote', tag: 'Seneca', text: "We suffer more in imagination than in reality." },
  { tone: 'quote', tag: 'Jim Rohn', text: "Discipline is the bridge between goals and accomplishment." },
  { tone: 'quote', tag: 'Kobe Bryant', text: "The most important thing is to try and inspire people so that they can be great in whatever they want to do." },
  { tone: 'quote', tag: 'Jocko Willink', text: "Discipline equals freedom." },
  { tone: 'quote', tag: 'Zig Ziglar', text: "You don't have to be great to start, but you have to start to be great." },
];

export function getDailyCoachLine({ streak = 0, doneCount = 0, totalTasks = 0 } = {}) {
  if (totalTasks > 0 && doneCount >= totalTasks) {
    return {
      tone: 'future',
      tag: 'done ✓',
      text: 'All of them checked. Close it clean while the win is fresh — tomorrow starts already ahead.'
    };
  }
  if (streak >= 7) {
    return {
      tone: 'future',
      tag: `${streak} days`,
      text: `${streak} days straight. That's not a streak anymore — that's a habit forming. Protect it.`
    };
  }
  if (streak === 0) {
    return {
      tone: 'steady',
      tag: 'day one',
      text: "Every chain starts with the first link. Make today that link."
    };
  }
  return pickDaily(coachLines, `daily-${streak}-${doneCount}`);
}

const worldTechniques = [
  {
    origin: 'Behavioral science',
    name: 'Ulysses Rule',
    tip: "Before you close today, lock tomorrow's first task. Set yourself up while it's still calm — before the distractions start negotiating."
  },
  {
    origin: 'Navy SEALs · David Goggins',
    name: '40% rule',
    tip: "When your brain says you're done, you're probably at about 40%. The first quit signal is a negotiation, not a fact. What's one more rep?"
  },
  {
    origin: 'Japan · Kaizen',
    name: 'Smallest useful step',
    tip: "What version of today's task feels easy enough to begin right now? Start there. Small starts beat big intentions every single time."
  },
  {
    origin: 'Soviet sports psychology · A.C. Puni',
    name: 'Boevaya gotovnost',
    tip: "Before you start: sit quietly for 90 seconds, picture yourself already mid-task — not beginning, but in flow. Mind leads, body follows."
  },
  {
    origin: 'Behavioral science · Peter Gollwitzer',
    name: 'If-then plan',
    tip: 'Write one right now: "If [specific thing pulls me away], I will [specific return action]." Recovery becomes automatic, not a willpower decision.'
  },
  {
    origin: 'James Clear · Atomic Habits',
    name: 'Identity vote',
    tip: "Each session is a vote for the person you're becoming. You're not just doing prep today — you're being someone who prepares consistently."
  },
  {
    origin: 'David Allen · GTD',
    name: '2-minute rule',
    tip: "If you're avoiding a task, commit to just 2 minutes. That's it. The hardest part is starting — once you're in, you usually stay in."
  },
  {
    origin: 'Stoic philosophy · Marcus Aurelius',
    name: 'Premeditatio start',
    tip: '"What\'s the best use of the next hour?" Ask it before you open anything else. Then do that first, before your attention gets pulled anywhere.'
  },
];

export function getDailyEdge() {
  return pickDaily(worldTechniques, 'edge');
}

export function getProgressCoach({ streak = 0, missedDays = 0, daysEngaged = 0, totalPoints = 0 } = {}) {
  if (streak >= 10) {
    return `${streak} days in a row. That's the hard part done. Keep it calm and repeatable.`;
  }
  if (missedDays > daysEngaged) {
    return "Restarts don't need speeches. Make today smaller than you think, finish it clean, and build from there.";
  }
  if (totalPoints >= 30) {
    return "The practice is stacking. You won't feel it session to session — but you'll feel it the moment someone asks a question you've actually worked on.";
  }
  return pickDaily([
    'Readiness usually shows up after you begin, not before it.',
    'A small daily win gives tomorrow something solid to stand on.',
    'You already know the direction. Today is just one more step that way.',
    'Consistency is showing up when it doesn\'t feel like the right time. Which is most days.',
  ], 'progress');
}
