import { pool } from '../db.js';

const userId = 'c0437184-24cd-4ca4-9516-a03a965bdc35';

async function checkFlows() {
    try {
        // Get the most recent flow or all flows for the user
        const res = await pool.query('SELECT id, name, definition FROM flows WHERE user_id = $1', [userId]);
        console.log(`Found ${res.rows.length} flows.`);
        
        for (const flow of res.rows) {
            console.log(`FLOW: ${flow.name} (${flow.id})`);
            const nodes = flow.definition.nodes || [];
            nodes.forEach((node: any) => {
                if (node.data && node.data.params && (node.data.params.authId || node.data.params.connection)) {
                     console.log(`  NODE: ${node.id} (${node.data.label || node.data.actionId})`);
                     console.log(`    AuthID: ${node.data.params.authId || node.data.params.connection}`);
                }
            });
            console.log('---');
        }
    } catch (err: any) {
        console.error("Error:", err.message);
    } finally {
        await pool.end();
    }
}

checkFlows();
