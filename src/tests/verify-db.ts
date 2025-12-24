import { pool } from '../db.js';

async function verify() {
  try {
    const users = await pool.query('SELECT * FROM users');
    console.log('Users:', users.rows);
    const integrations = await pool.query('SELECT user_id, service FROM google_integrations');
    console.log('Integrations:', integrations.rows);
    process.exit(0);
  } catch (err: any) {
    console.error(err);
    process.exit(1);
  }
}

verify();
