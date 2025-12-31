import { pool } from '../db.js';

const userId = 'c0437184-24cd-4ca4-9516-a03a965bdc35';
const flowId = '18eecda6-adeb-44c0-bdb1-4d1c3a2b1077';

async function fixFlow() {
    try {
        // 1. Get Latest Integrations
        const intsRes = await pool.query('SELECT id, service, created_at FROM integrations WHERE user_id = $1 ORDER BY created_at DESC', [userId]);
        const latestInts: Record<string, string> = {};
        
        for (const i of intsRes.rows) {
            if (!latestInts[i.service]) {
                latestInts[i.service] = i.id;
            }
        }
        
        console.log("Latest Integrations:", latestInts);

        // 2. Get Flow
        const flowRes = await pool.query('SELECT definition FROM flows WHERE id = $1', [flowId]);
        if (flowRes.rows.length === 0) {
            console.log("Flow not found");
            return;
        }
        
        const definition = flowRes.rows[0].definition;
        const nodes = definition.nodes || [];
        let modified = false;

        // 3. Update Nodes
        for (const node of nodes) {
            if (node.piece && latestInts[node.piece]) {
                // Check if 'connection' param exists
                if (node.params && node.params.connection && node.params.connection !== latestInts[node.piece]) {
                    console.log(`Updating node ${node.name} (${node.piece}): ${node.params.connection} -> ${latestInts[node.piece]}`);
                    node.params.connection = latestInts[node.piece];
                    modified = true;
                }
                 // Check if 'authId' param exists (just in case)
                 if (node.params && node.params.authId && node.params.authId !== latestInts[node.piece]) {
                    console.log(`Updating node ${node.name} (${node.piece}) authId: ${node.params.authId} -> ${latestInts[node.piece]}`);
                    node.params.authId = latestInts[node.piece];
                    modified = true;
                }
            }
        }

        // 4. Save
        if (modified) {
            await pool.query('UPDATE flows SET definition = $1 WHERE id = $2', [definition, flowId]);
            console.log("Flow updated successfully.");
        } else {
            console.log("No changes needed.");
        }

    } catch (err: any) {
        console.error("Error:", err.message);
    } finally {
        await pool.end();
    }
}

fixFlow();
