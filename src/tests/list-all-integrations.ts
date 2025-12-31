import { pool } from '../db.js';

const userId = 'c0437184-24cd-4ca4-9516-a03a965bdc35';

async function check() {
    try {
        const res = await pool.query('SELECT id, service, external_id, external_username, created_at FROM integrations WHERE user_id = $1 ORDER BY service', [userId]);
        console.log(JSON.stringify(res.rows, null, 2));
    } catch (err: any) {
        console.log("ERROR:", err.message);
    } finally {
        await pool.end();
    }
}

check();
