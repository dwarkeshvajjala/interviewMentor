// One-time: creates 3 Notion databases under NOTION_PARENT_PAGE_ID and prints their IDs.
// Usage: set NOTION_TOKEN + NOTION_PARENT_PAGE_ID in .env, then: npm run setup-notion
// Then paste the printed IDs into .env (NOTION_DAILY_DB_ID, etc.).
import 'dotenv/config';

const NOTION_VERSION = '2022-06-28';
const token = process.env.NOTION_TOKEN;
const parent = process.env.NOTION_PARENT_PAGE_ID;

if (!token || !parent) {
  console.error('Set NOTION_TOKEN and NOTION_PARENT_PAGE_ID in server/.env first.');
  console.error('Get a page ID from the page URL (the 32-char id at the end). Share that page with your integration.');
  process.exit(1);
}

async function createDb(title, properties) {
  const res = await fetch('https://api.notion.com/v1/databases', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Notion-Version': NOTION_VERSION, 'Content-Type': 'application/json' },
    body: JSON.stringify({ parent: { type: 'page_id', page_id: parent }, title: [{ text: { content: title } }], properties })
  });
  const data = await res.json();
  if (!res.ok) { console.error(`Failed to create "${title}":`, data.message); return null; }
  return data.id;
}

const sel = (opts) => ({ select: { options: opts.map(name => ({ name })) } });

const run = async () => {
  const daily = await createDb('Interview Rebuild — Daily Tracker', {
    Date: { title: {} },
    When: { date: {} },
    Mode: sel(['full', 'normal', 'low']),
    Status: sel(['pending', 'done', 'rest', 'skipped']),
    Energy: { number: {} },
    Mood: { number: {} },
    Summary: { rich_text: {} }
  });

  const questions = await createDb('Interview Question Bank', {
    Question: { title: {} },
    Topic: sel(['C#', '.NET', 'SQL', 'DSA', 'Azure', 'AI', 'React', 'Angular', 'Behavioral', 'Project']),
    Difficulty: sel(['Easy', 'Medium', 'Hard']),
    Status: sel(['New', 'Learning', 'Can Answer', 'Mock Passed']),
    Answer: { rich_text: {} }
  });

  const applications = await createDb('Job Applications', {
    Company: { title: {} },
    Role: { rich_text: {} },
    Location: { rich_text: {} },
    Source: sel(['LinkedIn', 'Naukri', 'Instahyre', 'Wellfound', 'Referral', 'Career page']),
    Status: sel(['Applied', 'Screen', 'Tech', 'Final', 'Offer', 'Rejected']),
    Applied: { date: {} }
  });

  console.log('\nDone. Paste these into server/.env:\n');
  console.log('NOTION_DAILY_DB_ID=' + (daily || ''));
  console.log('NOTION_QUESTIONS_DB_ID=' + (questions || ''));
  console.log('NOTION_APPLICATIONS_DB_ID=' + (applications || ''));
};

run();
