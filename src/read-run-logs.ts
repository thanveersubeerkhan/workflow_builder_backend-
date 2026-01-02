
import { pool } from './db.js';

const RUN_ID = process.argv[2] || 'afc393b8-80eb-40b5-a6f8-5f85cd8ba0ec';

async function readLogs() {
  try {
    const res = await pool.query('SELECT logs, status, current_context FROM flow_runs WHERE id = $1', [RUN_ID]);
    if (res.rows.length === 0) {
      console.log('Run not found');
      return;
    }
    const run = res.rows[0];
    console.log(`Run Status: ${run.status}`);
    
    let logs = run.logs;
    if (typeof logs === 'string') {
        try { logs = JSON.parse(logs); } catch(e) {}
    }
    
    console.log('\n--- LOGS ---');
    if (Array.isArray(logs)) {
        logs.forEach(l => console.log(l));
    } else {
        console.log(logs);
    }

    console.log('\n--- FAILED STEPS CONTEXT ---');
    const context = typeof run.current_context === 'string' ? JSON.parse(run.current_context) : run.current_context;
    if (context && context.steps) {
        Object.keys(context.steps).forEach(stepId => {
            const step = context.steps[stepId];
            if (step.data && (step.data.error || step.data.status === 'failed')) {
                console.log(`Step ${stepId}:`, JSON.stringify(step.data, null, 2));
            }
        });
    }

  } catch (e) {
    console.error(e);
  } finally {
    await pool.end();
  }
}

readLogs();
