import { pool } from '../db.js';

async function findTestUser() {
    console.log('[Diagnostic] Searching for a user with the most integrations...');

    const res = await pool.query(
        'SELECT user_id, COUNT(*) as count, ARRAY_AGG(service) as services FROM integrations GROUP BY user_id ORDER BY count DESC LIMIT 5'
    );

    console.log('Top Users by Integration Count:');
    res.rows.forEach(row => {
        console.log(`User: ${row.user_id} | Count: ${row.count} | Services: ${row.services.join(', ')}`);
    });

    await pool.end();
}

findTestUser().catch(console.error);
