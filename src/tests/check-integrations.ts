
import { pool, decrypt } from '../db.js';

async function checkIntegrations() {
    const userId = '8bebb0d3-c40e-4b48-9732-ff0694b71f9c';
    console.log(`[Diagnostic] checking integrations for user: ${userId}`);

    const res = await pool.query('SELECT * FROM integrations WHERE user_id = $1', [userId]);

    if (res.rows.length === 0) {
        console.log('[Diagnostic] ❌ No integrations found for this user.');
    } else {
        console.log(`[Diagnostic] Found ${res.rows.length} integrations:`);
        for (const row of res.rows) {
            console.log(`\n--- Service: ${row.service} ---`);
            console.log(`ID: ${row.id}`);
            console.log(`External ID: ${row.external_id}`);
            console.log(`External Username: ${row.external_username}`);
            console.log(`Has Refresh Token: ${!!row.refresh_token}`);
            console.log(`Has Access Token: ${!!row.access_token}`);
            console.log(`Expiry Date: ${row.expiry_date} (${new Date(Number(row.expiry_date)).toLocaleString()})`);
            console.log(`Scopes: ${row.scopes}`);
            
            if (row.refresh_token) {
                try {
                    const decrypted = decrypt(row.refresh_token);
                    console.log(`Refresh Token Decrypted: ${decrypted ? 'YES (length: ' + decrypted.length + ')' : 'NO'}`);
                } catch (e) {
                    console.log(`Refresh Token Decryption FAILED`);
                }
            }
        }
    }

    await pool.end();
}

checkIntegrations().catch(console.error);
