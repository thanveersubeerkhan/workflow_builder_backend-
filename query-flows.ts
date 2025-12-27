import 'dotenv/config';
import pkg from 'pg';
const { Pool } = pkg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

async function queryFlows() {
  try {
    const res = await pool.query('SELECT id, name, definition, ui_definition FROM flows LIMIT 10;');
    console.log(JSON.stringify(res.rows, null, 2));
    await pool.end();
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

queryFlows();
