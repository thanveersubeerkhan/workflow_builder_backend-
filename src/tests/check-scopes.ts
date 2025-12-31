import { pool } from '../db.js';

async function checkScopes() {
    const userId = '8bebb0d3-c40e-4b48-9732-ff0694b71f9c';
    console.log(`[Diagnostic] Checking scopes for user: ${userId}`);

    const res = await pool.query(
        'SELECT service, scopes, access_token, expiry_date FROM integrations WHERE user_id = $1',
        [userId]
    );

    for (const row of res.rows) {
        console.log(`--- Service: ${row.service} ---`);
        console.log(`Scopes: ${row.scopes}`);
        console.log(`Expires: ${new Date(Number(row.expiry_date)).toLocaleString()}`);
        console.log(`Token: ${row.access_token?.substring(0, 15)}...`);
        console.log('----------------------------\n');
    }

    await pool.end();
}

checkScopes().catch(console.error);
