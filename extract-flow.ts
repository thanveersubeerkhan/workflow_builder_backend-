import 'dotenv/config';
import pkg from 'pg';
import fs from 'fs';
const { Pool } = pkg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

async function extractComplexFlow() {
  try {
    const res = await pool.query('SELECT ui_definition FROM flows WHERE ui_definition->\'nodes\' IS NOT NULL AND jsonb_array_length(ui_definition->\'nodes\') > 2 LIMIT 1;');
    if (res.rows.length > 0) {
      fs.writeFileSync('complex_flow.json', JSON.stringify(res.rows[0].ui_definition, null, 2));
      console.log('Extracted complex_flow.json');
    } else {
      console.log('No complex flows found.');
    }
    await pool.end();
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

extractComplexFlow();
