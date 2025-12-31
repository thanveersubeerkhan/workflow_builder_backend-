import { pool, decrypt } from '../db.js';

const integrationId = '9181a035-bc7d-49e8-99d8-ed1563e7d093';

async function check() {
    try {
        const res = await pool.query('SELECT * FROM integrations WHERE id = $1', [integrationId]);
        if (res.rows.length === 0) {
            console.error("Integration not found");
            return;
        }

        const row = res.rows[0];
        console.log("Integration found:");
        console.log("- Service:", row.service);
        console.log("- Scopes:", row.scopes);
        console.log("- Access Token Prefix:", row.access_token ? row.access_token.substring(0, 10) + '...' : 'NONE');
        console.log("- Refresh Token Prefix:", row.refresh_token ? decrypt(row.refresh_token).substring(0, 10) + '...' : 'NONE');
        console.log("- Expiry Date:", new Date(Number(row.expiry_date)).toISOString());
        console.log("- Now:", new Date().toISOString());

    } catch (err: any) {
        console.error("Error:", err.message);
    } finally {
        await pool.end();
    }
}

check();
