
import { pool } from './db.js';

async function checkFlowState() {
    try {
        const res = await pool.query('SELECT id, is_active, next_run_time, last_trigger_data, definition FROM flows WHERE is_active = true');
        console.log(`[Check] Found ${res.rows.length} active flows.`);
        
        for (const flow of res.rows) {
            console.log('--------------------------------------------------');
            console.log(`Flow ID: ${flow.id}`);
            console.log(`Is Active: ${flow.is_active}`);
            console.log(`Next Run Time: ${flow.next_run_time} (${new Date(Number(flow.next_run_time)).toLocaleString()})`);
            console.log(`Now: ${Date.now()} (${new Date().toLocaleString()})`);
            console.log(`Window End (+30s): ${Date.now() + 30000}`);
            console.log(`Diff (NextRun - Now): ${Number(flow.next_run_time) - Date.now()} ms`);
            console.log(`Last Trigger Data:`, JSON.stringify(flow.last_trigger_data, null, 2));
            
            const def = flow.definition;
            if (def && def.trigger) {
                console.log(`Trigger Type: ${def.trigger.piece}.${def.trigger.name}`);
            } else {
                console.log('⚠️ Valid Definition or Trigger MISSING');
            }
        }
    } catch (err) {
        console.error('[Check] Failed:', err);
    } finally {
        await pool.end();
    }
}

checkFlowState();
