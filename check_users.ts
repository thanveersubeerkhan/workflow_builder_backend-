
import { pool } from './src/db';
import dotenv from 'dotenv';

dotenv.config();

async function check() {
  try {
    const res = await pool.query('SELECT DISTINCT user_id FROM flows');
    console.log('User IDs found:', res.rows);
    
    for (const row of res.rows) {
        const intRes = await pool.query('SELECT service, created_at FROM google_integrations WHERE user_id = $1', [row.user_id]);
        console.log(`Integrations for ${row.user_id}:`, intRes.rows);
    }

  } catch (err) {
    console.error(err);
  } finally {
    await pool.end();
  }
}

check();
