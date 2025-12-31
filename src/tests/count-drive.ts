import { pool } from '../db.js';

const userId = 'c0437184-24cd-4ca4-9516-a03a965bdc35';

async function check() {
    try {
        const res = await pool.query('SELECT id, service, external_username, created_at FROM integrations WHERE user_id = $1 AND service = $2', [userId, 'drive']);
        console.log(`TOTAL_DRIVE_INTEGRATIONS: ${res.rows.length}`);
        res.rows.forEach((r, i) => {
            console.log(`INT_${i}_ID: ${r.id}`);
            console.log(`INT_${i}_USER: ${r.external_username}`);
            console.log(`INT_${i}_CREATED: ${r.created_at}`);
        });
    } catch (err: any) {
        console.log("ERROR:", err.message);
    } finally {
        await pool.end();
    }
}

check();
