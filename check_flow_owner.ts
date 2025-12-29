
import { pool } from './src/db';
import dotenv from 'dotenv';
dotenv.config();

async function check() {
  try {
    const res = await pool.query("SELECT user_id FROM flows WHERE id = '35558a8c-8615-4fe6-8c6a-7f081dd0fed8'");
    console.log('Flow Owner User ID:', res.rows[0]?.user_id);
  } finally {
    await pool.end();
  }
}
check();
