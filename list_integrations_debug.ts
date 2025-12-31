
import dotenv from 'dotenv';
import { getIntegration } from './src/db.js';
// We need to access the db directly to list all, as getIntegration gets *one*.
// Let's rely on the pool from db.js if exported, or just make a new query.
// 'src/db.ts' exports 'pool'.

import pg from 'pg';
const { Pool } = pg;

dotenv.config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const userId = '8bebb0d3-c40e-4b48-9732-ff0694b71f9c';

async function listIntegrations() {
  try {
    const res = await pool.query('SELECT id, service, created_at FROM integrations WHERE user_id = $1', [userId]);
    console.log('=== User Integrations ===');
    if (res.rows.length === 0) {
        console.log('No integrations found.');
    } else {
        res.rows.forEach(row => {
            console.log(`Service: ${row.service.padEnd(15)} | ID: ${row.id} | Created: ${row.created_at}`);
        });
    }
  } catch (err) {
    console.error('Error querying DB:', err);
  } finally {
    await pool.end();
  }
}

listIntegrations();
