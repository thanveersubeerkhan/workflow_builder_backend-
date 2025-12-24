import { pool } from './src/db.js';

async function stopAllFlows() {
  console.log('--- Stopping All Flows ---');
  try {
    const res = await pool.query("UPDATE flows SET status = 'inactive' RETURNING id, name");
    console.log(`✅ Stopped ${res.rowCount} flows.`);
    res.rows.forEach(flow => console.log(` - ${flow.name} (${flow.id})`));
    process.exit(0);
  } catch (error: any) {
    console.error('❌ Failed to stop flows:', error.message);
    process.exit(1);
  }
}

stopAllFlows();
