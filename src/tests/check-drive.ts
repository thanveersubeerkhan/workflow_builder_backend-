import { pool, decrypt } from '../db.js';

const userId = 'c0437184-24cd-4ca4-9516-a03a965bdc35';

async function check() {
    try {
        const res = await pool.query('SELECT * FROM integrations WHERE user_id = $1 AND service = $2', [userId, 'drive']);
        const row = res.rows[0];
        if (!row) {
            console.log("NO INTEGRATION FOUND");
            return;
        }
        console.log("DRIVE_ID:", row.id);
        console.log("HAS_RT:", !!row.refresh_token);
        if (row.refresh_token) {
            const rt = decrypt(row.refresh_token);
            console.log("RT_PREFIX:", rt.substring(0, 10));
            console.log("RT_LENGTH:", rt.length);
        }
        console.log("SCOPES:", row.scopes);
    } catch (err: any) {
        console.error("Error:", err.message);
    } finally {
        await pool.end();
    }
}

check();
