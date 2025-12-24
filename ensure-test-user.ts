import { pool } from './src/db.js';

async function ensureUser() {
  const userId = '57d64ef3-aeb2-4428-9b04-e153f1febf37';
  const email = 'test-user@example.com';
  console.log(`Ensuring user ${userId} exists...`);
  
  try {
    await pool.query(
      'INSERT INTO users (id, email, name) VALUES ($1, $2, $3) ON CONFLICT (id) DO NOTHING',
      [userId, email, 'Test User']
    );
    console.log('✅ User ensured.');
    process.exit(0);
  } catch (err: any) {
    console.error('❌ Failed:', err.message);
    process.exit(1);
  }
}

ensureUser();
