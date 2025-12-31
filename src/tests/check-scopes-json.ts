import { pool } from '../db.js';
import fs from 'fs';

async function checkScopes() {
    const userId = 'c0437184-24cd-4ca4-9516-a03a965bdc35';
    console.log(`[Diagnostic] Checking scopes for user: ${userId}`);

    const res = await pool.query(
        'SELECT service, scopes, access_token, expiry_date FROM integrations WHERE user_id = $1',
        [userId]
    );

    const data = res.rows.map(row => ({
        service: row.service,
        scopes: row.scopes,
        expires: new Date(Number(row.expiry_date)).toLocaleString(),
        token_prefix: row.access_token?.substring(0, 15) + '...'
    }));

    fs.writeFileSync('integration_check.json', JSON.stringify(data, null, 2));
    console.log('[Diagnostic] Results written to integration_check.json');

    await pool.end();
}

checkScopes().catch(console.error);
