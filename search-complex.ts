import 'dotenv/config';
import pkg from 'pg';
const { Pool } = pkg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

async function findComplexFlows() {
  try {
    const res = await pool.query("SELECT id, name, ui_definition FROM flows WHERE ui_definition::text LIKE '%branch%' OR ui_definition::text LIKE '%condition%' LIMIT 5;");
    console.log(`Found ${res.rows.length} complex flows.`);
    res.rows.forEach(row => {
        console.log(`- FLOW: ${row.id} (${row.name})`);
    });
    if (res.rows.length > 0) {
        require('fs').writeFileSync('deep_complex_flow.json', JSON.stringify(res.rows[0].ui_definition, null, 2));
    }
    await pool.end();
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

findComplexFlows();
