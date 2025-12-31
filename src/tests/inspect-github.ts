import { pool } from '../db.js';

const userId = 'c0437184-24cd-4ca4-9516-a03a965bdc35';

async function checkGithub() {
    try {
        const res = await pool.query('SELECT id, service, refresh_token, access_token FROM integrations WHERE user_id = $1 AND service = $2', [userId, 'github']);
        console.log(JSON.stringify(res.rows, null, 2));
    } catch (err: any) {
        console.log("ERROR:", err.message);
    } finally {
        await pool.end();
    }
}

checkGithub();
