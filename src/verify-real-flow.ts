import { pool } from './db.js';
import { mapUIToDefinition } from './flow-mapper.js';

import axios from 'axios';

const FLOW_ID = '2edd47e5-6853-4523-b5c7-c6ffe73cbcd4';

async function verify() {
  const res = await pool.query('SELECT * FROM flows WHERE id = $1', [FLOW_ID]);
  const flow = res.rows[0];

  if (!flow) {
    console.error('Flow not found');
    process.exit(1);
  }

  console.log('--- UI DEFINITION (Nodes Only) ---');
  const ui = flow.ui_definition;
  console.log(ui.nodes.map((n: any) => `${n.id} (${n.type})`).join(', '));

  console.log('\n--- MAPPING ---');
  const mapped = mapUIToDefinition(ui);
  console.log(JSON.stringify(mapped, null, 2));
  
  // Optional: Update to ensure DB has latest
  await pool.query('UPDATE flows SET definition = $1 WHERE id = $2', [JSON.stringify(mapped), FLOW_ID]);
  console.log('Updated DB with fresh mapping');

  // Write to file for inspection
  try {
    const fs = await import('fs');
    fs.writeFileSync('debug-mapping.json', JSON.stringify({
        ui: ui.nodes.map((n: any) => ({ id: n.id, type: n.type, data: n.data })),
        mapped: mapped
    }, null, 2));
    console.log('Dumped debug-mapping.json');
  } catch (e) { console.error('Error writing debug file:', e); }

  // Trigger Run
  try {
      console.log('Triggering Flow Execution...');
      const res = await axios.post(`http://127.0.0.1:3000/api/flows/${FLOW_ID}/run`, { manual: true });
      console.log('Run Response:', JSON.stringify(res.data, null, 2));
  } catch (err: any) {
      console.error('Run Failed:', err.response?.data || err.message);
  }
  
  process.exit(0);
}

verify();
