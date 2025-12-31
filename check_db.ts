import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();

const { Pool } = pg;
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function check() {
  const res = await pool.query("SELECT id, service, scopes, created_at, updated_at FROM integrations WHERE service IN ('sheets', 'docs') ORDER BY updated_at DESC LIMIT 10;");
  res.rows.forEach(row => {
    console.log(`ID: ${row.id} | Service: ${row.service} | Scopes: ${row.scopes} | UpdatedAt: ${row.updated_at}`);
  });
  await pool.end();
}

check();
