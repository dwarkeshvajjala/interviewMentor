function seededIndex(key, length) {
  let hash = 0;
  for (let i = 0; i < key.length; i++) hash = ((hash << 5) - hash) + key.charCodeAt(i);
  return Math.abs(hash) % length;
}

function pickDaily(items, salt = '') {
  if (!items.length) return '';
  const key = `${new Date().toDateString()}-${salt}`;
  return items[seededIndex(key, items.length)];
}

export function getTimeGreeting(now = new Date(), name = 'Dwarkesh') {
  const hour = now.getHours();
  if (hour < 5) {
    return {
      title: `Hello night owl, ${name}`,
      label: 'late mission',
      line: 'Tiny rep only. Do one honest thing, then sleep like someone who kept a promise.'
    };
  }
  if (hour < 12) {
    return {
      title: `Good morning, ${name} sir`,
      label: 'fresh start',
      line: 'No heroic speech needed. Open the first task and let momentum do the talking.'
    };
  }
  if (hour < 17) {
    return {
      title: `Good afternoon, ${name}`,
      label: 'midday reset',
      line: 'The day is still negotiable. A 20-minute save is a real save.'
    };
  }
  if (hour < 21) {
    return {
      title: `Good evening, ${name}`,
      label: 'comeback window',
      line: 'This is the perfect hour to beat yesterday by one small rep.'
    };
  }
  return {
    title: `Night shift, ${name}`,
    label: 'quiet build',
    line: 'Keep it simple: one note, one task, one close. Future you loves receipts.'
  };
}

const dailyLines = [
  {
    tone: 'inspire',
    tag: 'truth',
    text: 'No coding for a year is rust, not identity. Rust comes off with reps.'
  },
  {
    tone: 'roast',
    tag: 'respectfully',
    text: 'Scrolling will not compile. One focused rep will at least throw a useful error.'
  },
  {
    tone: 'inspire',
    tag: 'receipt',
    text: 'Every tick is proof that the version of you inside your head is becoming visible.'
  },
  {
    tone: 'roast',
    tag: 'audit',
    text: 'Your dreams asked for evidence, not vibes. Give them 20 minutes.'
  },
  {
    tone: 'inspire',
    tag: 'career',
    text: 'The company version of you is not fixed. Daily practice is how you rewrite the record.'
  },
  {
    tone: 'money',
    tag: 'future',
    text: 'Better skills create better options. Better options change money, confidence, and freedom.'
  }
];

export function getDailyCoachLine({ streak = 0, doneCount = 0, totalTasks = 0 } = {}) {
  if (totalTasks > 0 && doneCount >= totalTasks) {
    return {
      tone: 'inspire',
      tag: 'done',
      text: 'Clean finish. Close the day and let the streak remember this for you.'
    };
  }
  if (streak >= 7) {
    return {
      tone: 'money',
      tag: `${streak} days`,
      text: 'That streak is not decoration. It is your new default forming in public.'
    };
  }
  if (streak === 0) {
    return {
      tone: 'roast',
      tag: 'start',
      text: 'The streak is waiting at zero like an unpaid bill. Pay it with one task.'
    };
  }
  return pickDaily(dailyLines, `daily-${streak}-${doneCount}`);
}

export function getProgressCoach({ streak = 0, missedDays = 0, daysEngaged = 0, totalPoints = 0 } = {}) {
  if (streak >= 10) {
    return 'This is no longer a mood. It is a system. Protect it with boring consistency.';
  }
  if (missedDays > daysEngaged) {
    return 'The comeback starts by making today smaller, not by hating yesterday harder.';
  }
  if (totalPoints >= 30) {
    return 'You are stacking proof now. Keep converting quiet work into interview confidence.';
  }
  return pickDaily([
    'Do not wait to feel ready. Readiness is what repeated days leave behind.',
    'Small daily wins are how you get out of the pit without needing a miracle.',
    'You already know what you want. This page is just the scoreboard for becoming that person.'
  ], 'progress');
}
