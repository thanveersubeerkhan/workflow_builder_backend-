import { pool, decrypt } from '../db.js';

const intId = '04039a9d-d07a-48dd-a5a5-95eff2091f37';

async function check() {
    try {
        const res = await pool.query('SELECT * FROM integrations WHERE id = $1', [intId]);
        if (res.rows.length === 0) {
            console.log(JSON.stringify({ error: "NOT_FOUND" }));
            return;
        }
        const row = res.rows[0];
        const status = {
            id: row.id,
            service: row.service,
            has_rt: !!row.refresh_token,
            rt_length: row.refresh_token ? decrypt(row.refresh_token).length : 0,
            rt_prefix: row.refresh_token ? decrypt(row.refresh_token).substring(0, 10) : "",
            scopes: row.scopes,
            created_at: row.created_at
        };
        console.log(JSON.stringify(status, null, 2));
    } catch (err: any) {
        console.log(JSON.stringify({ error: err.message }));
    } finally {
        await pool.end();
    }
}

check();
