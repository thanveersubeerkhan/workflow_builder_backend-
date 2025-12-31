import { pool } from '../db.js';

const flowId = '18eecda6-adeb-44c0-bdb1-4d1c3a2b1077';

async function dumpFlow() {
    try {
        const res = await pool.query('SELECT definition FROM flows WHERE id = $1', [flowId]);
        if (res.rows.length > 0) {
            console.log(JSON.stringify(res.rows[0].definition, null, 2));
        } else {
            console.log("Flow not found");
        }
    } catch (err: any) {
        console.error("Error:", err.message);
    } finally {
        await pool.end();
    }
}

dumpFlow();
