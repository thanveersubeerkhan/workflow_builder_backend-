
import { pool } from './src/db';
import dotenv from 'dotenv';

dotenv.config();

async function check() {
  try {
    const res = await pool.query('SELECT id, name, is_active, next_run_time, definition FROM flows ORDER BY updated_at DESC LIMIT 1');
    if (res.rows.length === 0) {
      console.log('No flows found');
       return;
    }
    const flow = res.rows[0];
    console.log('Flow ID:', flow.id);
    console.log('Name:', flow.name);
    console.log('Active:', flow.is_active);
    console.log('Next Run:', new Date(Number(flow.next_run_time)).toLocaleString());
    console.log('Definition Trigger:', JSON.stringify(flow.definition.trigger, null, 2));
  } catch (err) {
    console.error(err);
  } finally {
    await pool.end();
  }
}

check();
